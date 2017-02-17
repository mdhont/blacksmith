'use strict';

const nfile = require('nami-utils').file;
const nos = require('nami-utils').os;
const nutil = require('nami-utils').util;
const utils = require('common-utils');
const Vm = require('vm');
const Module = require('module');
const _ = require('nami-utils/lodash-extra');
const Spec = require('./spec');
const Logger = require('nami-logger');

/**
 * Class representing a Recipe. It has the ingredients to generate a {@link Component}
 * @namespace ComponentProvider.LogicProvider
 * @class
 * @param {string|string[]} recipeDirectories - Directories to look for recipes
 * @param {string[]} componentTypeCollections - NPM modules that export component types
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger to use
 * @example
 * new LogicProvider('/home/recipes/', ['blacksmith-base-components'])
 */
class LogicProvider {
  constructor(recipeDirectories, componentTypeCollections, options) {
    options = options || {};
    this._recipeDirectories = recipeDirectories;
    this.logger = options.logger || new Logger({level: 'silent'});
    this._componentTypeCollections = ['../../../../base-components'].concat(componentTypeCollections);
  }

  _loadRecipeJS(file) {
    const mod = new Module(file);
    // Inherit the current load paths
    mod.paths = module.paths;

    // Provide a set of global variables to be available in the
    // loaded file. This allows simplifying the JS files
    const sandbox = {
      module: mod,
      __filename: file,
      __dirname: nfile.dirname(file),
      console: console,
      process: process,
      Spec: Spec,
      $bu: utils,
      $os: nos,
      $file: nfile,
      $util: nutil,
      $loadBuildInstructions: (id) => {
        return this.loadBuildInstructions(id, this.findRecipeFolder(id, this._recipeDirectories));
      },
      _: _,
      path: require('path'),
      require: function(p) {
        return mod.require(p);
      }
    };
    _.each(this._componentTypeCollections, componentCollection => {
      const exportedTypes = require(componentCollection); // Each NPM module can have more
                                                          // than one component defined
      _.each(exportedTypes, component => {
        const componentName = component.name;
        sandbox[componentName] = component;
      });
    });
    const script = new Vm.Script(nfile.read(file));
    return script.runInNewContext(sandbox);
  }

  /**
   * Find the folder of a recipe.
   * @function ComponentProvider.LogicProvider~findRecipeFolder
   * @param {string} id - ID of the component
   * @param {array} recipeDirectories - Directories to look for recipes
   * @return {string} - Path to the folder
   */
  findRecipeFolder(id, recipeDirectories) {
    let componentRecipeDir = null;
    recipeDirectories = recipeDirectories || this._recipeDirectories;
    try {
      componentRecipeDir = utils.find(recipeDirectories, id, {maxDepth: 3, findAll: true});
    } catch (e) {
      throw new Error(`Unable to find a recipe for ${id} in ${recipeDirectories}. Received:\n${e.message}`);
    }
    if (componentRecipeDir.length > 1) {
      throw new Error(`Found several possible recipe directories for ${id} in ${recipeDirectories}`);
    }
    return componentRecipeDir[0];
  }

  /**
   * Load a Javascript file in a sandbox containing a recipe. Throws an error if the recipe is not found.
   * It will recursively lookk in recipeDirectories for an index.js file inside a folder named as the component ID
   * such as {{recipeDir}}/{{id}}[/compilation]/index.js
   * @function ComponentProvider.LogicProvider~loadBuildInstructions
   * @param {string} id - ID of the component
   * @param {array} recipeDirectories - Directories to look for recipes
   * @return - The compiled result of the recipe if found
   */
  loadBuildInstructions(id, recipeDir) {
    let result = null;
    recipeDir = recipeDir || this.findRecipeFolder(id, this._recipeDirectories);
    if (!_.isEmpty(recipeDir)) {
      const compilationDir = nfile.exists(nfile.join(recipeDir, 'compilation')) ?
      nfile.join(recipeDir, 'compilation') : recipeDir;
      const jsFile = nfile.join(compilationDir, 'index.js');
      if (nfile.exists(jsFile)) {
        result = this._loadRecipeJS(jsFile);
      }
    }
    if (!result) {
      throw new Error(`Unable to find a recipe for ${id}`);
    }
    return result;
  }

  /**
   * Obtain a recipe Classs
   * @function ComponentProvider.LogicProvider~getRecipeClass
   * @param {string} id - ID of the component
   * @param {array} recipeDir - Directory of the recipe
   * @param {Object} requirements - Requirements that the Class need to satisfy
   * @return - The compiled result of the recipe if found
   */
  getRecipeClass(id, recipeDir, requirements) {
    recipeDir = recipeDir || this.findRecipeFolder(id, this._recipeDirectories);
    requirements = requirements || {};
    let ComponentClass = null;
    const recipe = this.loadBuildInstructions(id, recipeDir);
    // the loaded JS module can return either:
    // a class: OpenSSL
    // a factory function to call: function factory(requirements) { return OpenSSL };
    // or a version/class map to resolve: [{version: '>0.9', class: OpenSSL}, {version: '0.9.x', class: OpenSslLegacy}]
    if (recipe.toString().match(/^class .*/)) {
      ComponentClass = recipe;
    } else if (_.isFunction(recipe)) {
      ComponentClass = recipe(requirements);
    } else {
      ComponentClass = Spec.findMatchingSpec(recipe, requirements).class;
    }
    return ComponentClass;
  }
}

module.exports = LogicProvider;

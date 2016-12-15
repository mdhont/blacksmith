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
 * @namespace ComponentProvider.Recipe
 * @class
 * @param {string} id - Recipe ID
 * @param {string|array} path - Path to look for recipes
 * @param {Object} [requirements] - Object defining the recipe requirements
 * @param {Object} [options]
 * @returns {Object} Recipe Recipe of the component
 * @returns {string} Recipe.version Version of the component
 * @returns {Object} Recipe.metadata Software information of the component
 * @returns {Object} Recipe.componentClass Class with the compilation logic
 * @example
 * new Recipe('ncurses', 'recipes/lib/ncurses')
 * // => { componentClass: [Function: Ncurses],
 * //      metadata: {
 * //        id: 'ncurses',
 * //        version: '5.9',
 * //        licenses: [ { type: 'MIT', licenseRelativePath: 'ANNOUNCE' } ],
 * //        licenseRelativePath: null,
 * //        licenseUrl: null,
 * //        tarballName: null }}
 */
class LogicProvider {
  constructor(recipeDirectories, componentTypeCollections, options) {
    options = options || {};
    this._recipeDirectories = recipeDirectories;
    this.logger = options.logger || new Logger({level: 'silent'});
    this._componentTypeCollections = componentTypeCollections;
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

  findRecipeFolder(id, recipeDirectories) {
    let componentRecipeDir = null;
    recipeDirectories = recipeDirectories || this._recipeDirectories;
    _.each(recipeDirectories, dir => {
      this.logger.trace(`Looking for recipes under ${dir}`);
      if (!nfile.exists(dir)) {
        this.logger.trace(`Skipping non-existent dir ${dir}`);
        return;
      }
      nfile.walkDir(dir, function(f) {
        if (nfile.basename(f) === id && nfile.isDirectory(f)) {
          componentRecipeDir = f;
          return false;
        }
      });
      // Don't keep looking
      if (componentRecipeDir) return false;
    });
    return componentRecipeDir;
  }

  /**
   * Load a Javascript file in a sandbox containing a recipe. Throws an error if the recipe is not found.
   * It will recursively lookk in recipeDirectories for an index.js file inside a folder named as the component ID
   * such as {{recipeDir}}/{{id}}[/compilation]/index.js
   * @function ComponentProvider.Recipe~loadRecipe
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

  getRecipeClass(id, recipeDir, requirements) {
    recipeDir = recipeDir || this.findRecipeFolder(id, this._recipeDirectories);
    requirements = requirements || {};
    let componentClass = null;
    const recipe = this.loadBuildInstructions(id, recipeDir);
    // the loaded JS module can return either:
    // a class: OpenSSL
    // a factory function to call: function factory(requirements) { return OpenSSL };
    // or a version/class map to resolve: [{version: '>0.9', class: OpenSSL}, {version: '0.9.x', class: OpenSslLegacy}]
    if (recipe.toString().match(/^class .*/)) {
      componentClass = recipe;
    } else if (_.isFunction(recipe)) {
      componentClass = recipe(requirements);
    } else {
      componentClass = Spec.findMatchingSpec(recipe, requirements).class;
    }
    return componentClass;
  }
}

module.exports = LogicProvider;

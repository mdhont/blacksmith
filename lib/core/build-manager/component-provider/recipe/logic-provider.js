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

  /**
   * Load a Javascript file in a sandbox containing a recipe.
   * @function ComponentProvider.LogicProvider~loadBuildInstructions
   * @param {string} recipePath - Path to the compilation recipe
   * @return - The compiled result of the recipe if found
   */
  loadBuildInstructions(recipePath) {
    const mod = new Module(recipePath);
    // Inherit the current load paths
    mod.paths = module.paths;

    // Provide a set of global variables to be available in the
    // loaded file. This allows simplifying the JS files
    const sandbox = {
      module: mod,
      __filename: recipePath,
      __dirname: nfile.dirname(recipePath),
      console: console,
      process: process,
      Spec: Spec,
      $bu: utils,
      $os: nos,
      $file: nfile,
      $util: nutil,
      $loadBuildInstructions: (path) => {
        return this.loadBuildInstructions(path);
      },
      _: _,
      path: require('path'),
      require: function(p) {
        return mod.require(p);
      }
    };
    // Expose available component types
    _.each(this._componentTypeCollections, componentCollection => {
      const exportedTypes = require(componentCollection); // Each NPM module can have more
                                                          // than one component defined
      _.each(exportedTypes, component => {
        const componentName = component.name;
        sandbox[componentName] = component;
      });
    });

    const script = new Vm.Script(nfile.read(recipePath));
    return script.runInNewContext(sandbox);
  }

  /**
   * Obtain a recipe Classs
   * @function ComponentProvider.LogicProvider~getRecipeClass
   * @param {string} recipePath - Path to the compilation recipe of the component
   * @param {Object} requirements - Requirements that the Class need to satisfy
   * @return - The compiled result of the recipe if found
   */
  getRecipeClass(recipePath, requirements) {
    requirements = requirements || {};
    let ComponentClass = null;
    const recipe = this.loadBuildInstructions(recipePath);
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

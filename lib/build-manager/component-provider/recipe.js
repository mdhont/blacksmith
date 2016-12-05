'use strict';

const nfile = require('nami-utils').file;
const nhb = require('nami-utils/templates');
const nos = require('nami-utils').os;
const nutil = require('nami-utils').util;
const utils = require('common-utils');
const Vm = require('vm');
const Module = require('module');
const _ = require('nami-utils/lodash-extra');
const Spec = require('./spec');

/**
 * Class representing a Recipe. It has the ingredients to generate a {@link Component}
 * @namespace ComponentProvider.Recipe
 * @class
 * @param {string} id - Recipe ID
 * @param {string} path - Path to the recipe
 * @param {Object} [requirements] - Object defining the recipe requirements
 * @param {Object} [options]
 * @param {Object} [options.searchPath] - Additional search paths
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
class Recipe {
  constructor(id, metadata, options) {
    options = _.defaults(options || {}, {
      path: null,
      metadataServer: {endPoint: null, prioritize: false},
      requirements: {},
      componentTypeCollections: []
    });
    this.metadata = metadata;

    // Validate obtained metadata
    this.validateMetadata(this.metadata);
    // Supports interpolating id and version in metadata
    this.metadata = JSON.parse(nhb.renderText(JSON.stringify(this.metadata),
        {id: this.id, version: this.metadata.version}));
    this._componentTypeCollections = options.componentTypeCollections;
    this.componentClass = this._getRecipeClass(options.path, options.requirements);
    if (!this.componentClass) {
      throw new Error(`Not found a recipe for ${id}`);
    }
  }

  /**
   * Validate given metadata. Throws an error if the metadata is not valid
   * @function ComponentProvider.Recipe~validateMetadata
   * @param {Object} metadata - Metadata to validate
   */
  validateMetadata(metadata) {
    _.each(['id', 'version', 'licenses'], p => {
      if (_.isEmpty(metadata[p])) {
        throw new Error(`Error validating the component metadata: The field ${p} is empty`);
      }
    });
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

  _getRecipeClass(recipeDir, requirements) {
    let componentClass = null;
    // Is not mandatory to have a recipe class, it could be just a base one
    if (!_.isEmpty(recipeDir)) {
      const compilationDir = nfile.exists(nfile.join(recipeDir, 'compilation')) ?
      nfile.join(recipeDir, 'compilation') : recipeDir;
      const jsFile = nfile.join(compilationDir, 'index.js');
      if (nfile.exists(jsFile)) {
        const result = this._loadRecipeJS(jsFile);
        // the loaded JS module can return either:
        // a class: OpenSSL
        // a version/class map to resolve: [{version: '>0.9', class: OpenSSL}, {version: '0.9.x', class: OpenSslLegacy}]
        // or a factory function to call: function factory(requirements) { return OpenSSL };
        if (result.toString().match(/^class .*/)) {
          componentClass = result;
        } else if (_.isFunction(result)) {
          componentClass = result(requirements);
        } else {
          componentClass = Spec.findMatchingSpec(result, requirements).class;
        }
      }
    }
    return componentClass;
  }
}

module.exports = Recipe;

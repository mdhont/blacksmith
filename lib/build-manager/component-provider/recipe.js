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
const versionUtils = require('version-utils');
const semver = require('semver');
const Logger = require('nami-logger');

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
  constructor(id, recipeDirectories, componentTypeCollections, options) {
    options = _.defaults(options || {}, {
      metadataServer: {endPoint: null, prioritize: false},
      requirements: {},
      logger: new Logger({level: 'silent'})
    });
    this.logger = options.logger;
    this._searchPath = _.flatten([recipeDirectories]);
    const recipeDir = this._findRecipeFile(id, recipeDirectories);
    const requirements = options.requirements || {};
    this.metadata = this._obtainMetadata(id, requirements, recipeDir);
    if (_.isEmpty(requirements)) requirements.version = requirements.version || this.metadata.version;

    // Validate obtained metadata
    this.constructor.validateMetadata(this.metadata);
    // Supports interpolating id and version in metadata
    this.metadata = JSON.parse(nhb.renderText(JSON.stringify(this.metadata),
        {id: this.id, version: this.metadata.version}));
    this._componentTypeCollections = componentTypeCollections;
    this.componentClass = this._getRecipeClass(id, requirements);
    if (!this.componentClass) {
      throw new Error(`Not found a recipe for ${id}`);
    }
  }

  _findRecipeFile(id, recipeDirectories) {
    let componentRecipeDir = null;
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

  _getMetadataFromAnvil(id, version) {
    this.logger.debug(`Contacting the metadata server to obtain info about ${id}`);
    const versionInfo = _.isEmpty(version) ?
                       this.metadataServer.client.getLatestVersion(id) :
                       this.metadataServer.client.getVersion(id, version);
    return {
      id: id,
      version: versionInfo.name,
      licenses: _.map(versionInfo.licenses, lic => {
        return {
          type: lic.name,
          licenseRelativePath: lic.relative_license_path,
          licenseUrl: lic.url,
          main: lic.main
        };
      })
    };
  }

  _resolveVersion(requirement, latest, availableBranches) {
    let result = versionUtils.isSpecificVersion(requirement) ? requirement : null;
    // Resolve version if needed
    if (result === null) {
      if (_.isEmpty(requirement) ||
        requirement === 'latest' ||
        semver.satisfies(versionUtils.getSemanticVersion(latest).split('-')[0], requirement)) {
        result = latest;
      } else {
        if (!_.isUndefined(availableBranches)) {
          const matching = _.pick(availableBranches, v => {
            return semver.satisfies(versionUtils.getSemanticVersion(v.latest, {omitPreRelease: true}), requirement);
          });
          const latestMatching = _.map(matching, 'latest');
          switch (latestMatching.length) {
            case 1:
              result = latestMatching[0];
              break;
            case 0:
              throw new Error(`Cannot find version that matches the defined range ${requirement}`);
            default:
              throw new Error(`The defined range ${requirement} has more than one occurrences: ` +
                `${latestMatching.join(', ')}`);
          }
        } else {
          throw new Error(`Not found any version satisfying ${requirement} in the current metadata`);
        }
      }
    }
    return result;
  }

  _getMatchingVersions(baseVersion, availableVersions) {
    const result = [];
    if (!_.isUndefined(availableVersions)) {
      const _minorVersion = baseVersion.match(/([0-9]+\.[0-9]+).*/);
      const _majorVersion = baseVersion.match(/([0-9]+).*/);
      if (!_.isNull(_majorVersion) &&
      !_.isUndefined(availableVersions[_majorVersion[1]])) {
        // Metadata from major version found
        result.push(_majorVersion[1]);
      }
      if (!_.isNull(_minorVersion) &&
      !_.isUndefined(availableVersions[_minorVersion[1]])) {
        // Metadata from minor version found
        result.push(_minorVersion[1]);
      }
    }
    result.push(baseVersion);
    return result;
  }

  _getMetadataFromFile(metadataFile, requiredVersion) {
    this.logger.debug(`Using metadata from ${metadataFile}`);
    let metadata = JSON.parse(nfile.read(metadataFile));
    if (!_.isUndefined(metadata.component)) {
      _.extend(metadata.component, _.pick(
        metadata, ['id', 'latest', 'versions']
      ));
      metadata = metadata.component;
    }
    const version = this._resolveVersion(requiredVersion, metadata.latest, metadata.versions);
    const _versions = this._getMatchingVersions(version, metadata.versions);
    // Get metadata from found versions
    _.each(_versions, v => {
      metadata = _.extend(metadata, _.get(metadata.versions, v));
    });
    // Replace latest with actual version
    metadata.version = metadata.latest;
    delete metadata.latest;

    return metadata;
  }

  _obtainMetadata(id, requirements, path) {
    let result = null;
    if (!this.metadataServer &&
     (_.isEmpty(path) || !nfile.exists(nfile.join(path, 'metadata.json')))) {
      throw new Error(`Not found any source of metadata for ${id}`);
    }
    if (this.metadataServer && this.metadataServer.prioritize) {
      result = this._getMetadataFromAnvil(id, requirements.version);
    } else {
      if (!_.isEmpty(path) && nfile.exists(nfile.join(path, 'metadata.json'))) {
        result = this._getMetadataFromFile(nfile.join(path, 'metadata.json'), requirements.version);
      } else {
        result = this._getMetadataFromAnvil(id, requirements);
      }
    }
    return result;
  }

  /**
   * Validate given metadata. Throws an error if the metadata is not valid
   * @function ComponentProvider.Recipe~validateMetadata
   * @param {Object} metadata - Metadata to validate
   */
  static validateMetadata(metadata) {
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
      $loadBuildInstructions: (id) => {
        return this.loadBuildInstructions(id, this._searchPath);
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
   * Load a Javascript file in a sandbox containing a recipe. Throws an error if the recipe is not found
   * @function ComponentProvider.Recipe~loadRecipe
   * @param {string} id - ID of the component
   * @param {array} recipeDirectories - Directories to look for recipes
   */
  loadBuildInstructions(id, recipeDirectories) {
    const recipeDir = this._findRecipeFile(id, recipeDirectories);
    let result = null;
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

  _getRecipeClass(id, requirements) {
    let componentClass = null;
    const recipe = this.loadBuildInstructions(id, this._searchPath);
    // the loaded JS module can return either:
    // a class: OpenSSL
    // a version/class map to resolve: [{version: '>0.9', class: OpenSSL}, {version: '0.9.x', class: OpenSslLegacy}]
    // or a factory function to call: function factory(requirements) { return OpenSSL };
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

module.exports = Recipe;

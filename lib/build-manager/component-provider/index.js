'use strict';

const nfile = require('nami-utils').file;
const _ = require('nami-utils/lodash-extra');
const Logger = require('nami-logger');
const Recipe = require('./recipe');
const versionUtils = require('version-utils');
const semver = require('semver');


/**
 * Class representing the Component Provider
 * @namespace ComponentProvider
 * @class
 * @param {string|Array} recipeDirectories - Path to recipe folders
 * @param {Object} componentTypeCollections - Collection of component types to use
 * @param {Object} [options]
 * @param {Object} [options.metadataServer] - MetadataServer configuration
 * @param {boolean} [options.metadataServer.activate] - Use a metadata server
 * @param {boolean} [options.metadataServer.prioritize] - Prioritize the metadata server
 * @param {Object} [options.logger] - Logger to use
 */
class ComponentProvider {
  constructor(recipeDirectories, componentTypeCollections, options) {
    options = _.opts(options, {
      logger: null,
      metadataServer: {
        activate: false,
        prioritize: false,
        endPoint: null
      }
    });
    this.metadataServer = null;
    if (options.metadataServer.activate) {
      this.metadataServer = {
        client: this._getAnvilClient(options.metadataServer.endPoint),
        prioritize: options.metadataServer.prioritize
      };
    }
    this._searchPath = _.toArrayIfNeeded(recipeDirectories);
    this.componentTypeCollections = componentTypeCollections;
    this.logger = options.logger || new Logger({level: 'silent'});
  }

  _getAnvilClient(endPoint) {
    const AnvilClient = require('anvil-client');
    if (_.isEmpty(endPoint)) {
      throw new Error('To activate the metadata server you need to provide an end point URL');
    }
    return new AnvilClient(endPoint);
  }

  /**
   * Returns a {@link Recipe} from a recipe directory applying requirements
   * @function ComponentProvider~getRecipe
   * @param {string} id - ID of the component
   * @param {Object} [requirements] - Object setting the requirements that the recipe should be applied for
   * @returns {@link Recipe}
   * @example
   * getRecipe('zlib', {version: '~1.2'});
   */
  getRecipe(id, requirements) {
    const recipeDir = this.findRecipe(id);
    requirements = requirements || {};
    const metadata = this._obtainMetadata(id, requirements, recipeDir);
    if (_.isEmpty(requirements)) requirements.version = requirements.version || metadata.version;
    return new Recipe(id, metadata, {
      componentTypeCollections: this.componentTypeCollections,
      path: recipeDir,
      requirements
    });
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

  /**
   * Look for a recipe
   * @function ComponentProvider~findRecipe
   * @param {string} id - ID of the component
   * @returns {string} - Path to the recipe or null if not found
   * @example
   * findRecipe('zlib');
   * // => 'recipes/libraries/zlib'
   */
  findRecipe(id) {
    let componentRecipeDir = null;
    _.each(this._searchPath, dir => {
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
   * Parse a reference
   * @function Blacksmith.BuildManager.ComponentProvider~parseComponentReference
   * @param {string|Object} reference - Component reference. Can be a string or an object specifying its properties
   * @returns {Object} - Object defining parsed properties
   * @example
   * // Parse a string reference:
   * parseComponentReference('zlib');
   * // => {version: null, id: 'zlib', sourceTarball: null, patches: [], extraFiles: []}
   * @example
   * // Parse a string reference including version and tarball path:
   * parseComponentReference('zlib@1.2.3:/tmp/zlib-1.2.3.tar.gz');
   * // => {version: 1.2.3, id: 'zlib', sourceTarball: /tmp/zlib-1.2.3.tar.gz, patches: [], extraFiles: []}
   * @example
   * // Parse an object reference:
   * parseComponentReference({version: '5.5.21', tarball: '/tmp/php-5.5.21.tar.gz'}, patches: ['/tmp/php.patch']);
   * // => {
   *        version: '5.5.21', id: 'php',
   *        sourceTarball: '/tmp/php-5.5.21.tar.gz',
   *        patches: ['/tmp/php.patch'], extraFiles: []}
   */
  parseComponentReference(reference) {
    let id = null;
    let sourceTarball = null;
    let version = null;
    let patches = [];
    let extraFiles = [];
    if (_.isString(reference)) {
      const match = reference.match(/^([^@:]*)(@([^:]*))?(:(.*))?$/);
      id = match[1];
      if (!_.isEmpty(match[3])) version = match[3];
      if (!_.isEmpty(match[5])) sourceTarball = match[5];
    } else if (_.isObject(reference)) {
      sourceTarball = reference.sourceTarball || null;
      id = reference.id;
      version = reference.version;
      patches = reference.patches || [];
      extraFiles = reference.extraFiles || [];
    } else {
      throw new Error(`Don't know how to parse component reference ${JSON.stringify(reference)}`);
    }
    if (_.isEmpty(sourceTarball)) {
      this.logger.warn(`You should specify a sourceTarball for ${id}. ` +
        `F.e. ${id}@version:/path/to/${id}.tar.gz or specify it in the JSON input`);
    }
    return {version, id, sourceTarball, patches, extraFiles};
  }

  /**
   * Looks for a recipe and instatiate it to return a {@link Component}
   * @function ComponentProvider~getComponent
   * @param {Object|string} componentData - Component information
   * @param {Object} componentData.id - ID of the component
   * @param {Object} [componentData.version] - Default version of the component
   * @param {Object} [componentData.sourceTarball] - Default path to the component tarball
   * @param {Object} [requirements] - Requirements for the component
   * @returns {@link Component}
   * @example
   * getComponent('zlib', {version: '~1.2'});
   */
  getComponent(componentData, requirements) {
    let componentId = null;
    let componentVersion = null;
    if (_.isString(componentData)) {
      componentId = componentData;
    } else if (_.isReallyObject(componentData) && !_.isUndefined(componentData.id)) {
      componentId = componentData.id;
      if (!_.isUndefined(componentData.version)) {
        componentVersion = componentData.version;
        requirements = _.opts(requirements, {version: componentVersion});
      }
    }
    const recipe = this.getRecipe(componentId, requirements);
    const ComponentClass = recipe.componentClass;
    const component = new ComponentClass(recipe.metadata);
    component.id = component.id || componentId;
    _.extend(component, _.pick(componentData, ['sourceTarball', 'patches', 'extraFiles']));
    return component;
  }
}

module.exports = ComponentProvider;

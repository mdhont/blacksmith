'use strict';

const nfile = require('nami-utils').file;
const nhb = require('nami-utils/templates');
const _ = require('nami-utils/lodash-extra');
const versionUtils = require('version-utils');
const semver = require('semver');
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
class MetadataProvider {
  constructor(recipeDirectories, metadataServer, options) {
    options = options || {};
    this.logger = options.logger || new Logger({level: 'silent'});
    this.metadataServer = _.defaults({}, metadataServer, {
      client: null,
      prioritize: false
    });
    this._recipeDirectories = _.flatten([recipeDirectories]);
  }

  _getMetadataFromAnvil(id, version) {
    this.logger.debug(`Contacting the metadata server to obtain info about ${id}`);
    let versionInfo = null;
    versionInfo = _.isEmpty(version) ?
      this.metadataServer.client.getLatestVersion(id) :
      this.metadataServer.client.getVersion(id, version);

    return {
      id: id,
      version: versionInfo.name,
      licenses: _.map(versionInfo.licenses, lic => {
        return {
          type: lic.name,
          licenseRelativePath: lic.license_relative_path,
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

  // While Anvil is not mandatory, don't fail if the request to Anvil fails
  _softAnvilRequest(id, version) {
    let result = null;
    try {
      result = this._getMetadataFromAnvil(id, version);
    } catch (e) {
      // Failed to get from Anvil
      this.logger.debug(e.message);
    }
    return result;
  }

  getMetadata(id, options) {
    options = _.defaults({}, options, {
      requirements: {},
      recipeDir: null
    });
    let result = null;
    if (!this.metadataServer.client &&
     (_.isEmpty(options.recipeDir) || !nfile.exists(nfile.join(options.recipeDir, 'metadata.json')))) {
      throw new Error(`Not found any source of metadata for ${id}`);
    }
    let contactedAnvil = false;
    if (this.metadataServer.client && this.metadataServer.prioritize) {
      result = this._softAnvilRequest(id, options.requirements.version);
      contactedAnvil = true;
    }
    if (_.isEmpty(result)) {
      if (!_.isEmpty(options.recipeDir) && nfile.exists(nfile.join(options.recipeDir, 'metadata.json'))) {
        result = this._getMetadataFromFile(
          nfile.join(options.recipeDir, 'metadata.json'),
          options.requirements.version
        );
      } else if (this.metadataServer.client && !contactedAnvil) {
        result = this._softAnvilRequest(id, options.requirements.version);
      }
    }
    if (_.isEmpty(result)) {
      let messageError = `Not found any metadata for ${id}`;
      if (!_.isEmpty(options.requirements)) messageError += ` satisfying: ${JSON.stringify(options.requirements)}`;
      throw new Error(messageError);
    }
    // Validate obtained metadata
    this.constructor.validateMetadata(result);
    return result;
  }
}

module.exports = MetadataProvider;

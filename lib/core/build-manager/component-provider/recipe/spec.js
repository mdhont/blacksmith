'use strict';

const _ = require('nami-utils/lodash-extra');
const versionUtils = require('version-utils');
const semver = require('semver');

/**
 * Class representing a specification.
 * @namespace ComponentProvider.Spec
 * @class
 * @param {Object} specHash - Object containing the specifications
 * @param {string} [specHash.version] - Version specification
 * @param {Array} [specHash.platforms] - Platforms specification
*/
class Spec {
  constructor(specHash) {
    specHash = _.opts(specHash, {version: null, platforms: [], id: null});
    this.version = specHash.version;
    this.platforms = _.toArrayIfNeeded(specHash.platforms);
    this.id = specHash.id;
  }

  /**
   * Check if the current specification satisfies the given requirements
   * @function ComponentProvider.Spec~satisfies
   * @param {Object} requirements - Requirements to satisfy
   * @param {string} [requirements.version] - Version to satisfy
   * @param {string} [requirements.platform] - Platform to satisfy
   */
  satisfies(requirements) {
    let satisfies = true;
    _.each(requirements, (value, key) => {
      if (!_.isNull(value) && satisfies) {
        switch (key) {
          case 'version': {
            const cleanedRequiredVersion = versionUtils.getSemanticVersion(value, {omitPreRelease: true});
            if (this.version !== null
              && !semver.satisfies(cleanedRequiredVersion, this.version)) {
              satisfies = false;
            }
            break;
          }
          case 'platform':
            if (!_.isEmpty(this.platforms)) {
              if (!_.includes(this.platforms, value)) satisfies = false;
            }
            break;
          case 'id':
            if (this.id !== null
              && value !== this.id) satisfies = false;
            break;
          default:
            throw new Error(`Don't know how to handle requirement ${key}`);
        }
      }
    });
    return satisfies;
  }
}

/**
 * Shorthand for manually instantiating several Specs and compare them with the given requirements
 * @function ComponentProvider.Spec~findMatchingSpec
 * @param {Array} specList - List of specifications to evaluate specifying version and platform
 * @param {Object} requirements - Requirements to satisfy
 * @param {string} [requirements.version] - Version to satisfy
 * @param {string} [requirements.platform] - Platform to satisfy
 * @throws - Throw an error if none of the given specifications satisfies the requirements
 * @example
 * findMatchingSpec([
 *   {version: '>1.0', platform: 'linux-x64'},
 *   {version: '>2.0', platform: 'linux-x64'}
 * ], {version: 2.0.1});
 * // => {version: '>2.0', platform: 'linux-x64'}
 */
function findMatchingSpec(specList, requirements) {
  const match = _.find(specList, spec => new Spec(spec).satisfies(requirements));
  if (!match) {
    throw new Error(`Cannot find any valid specification matching the provided requirements`);
  } else {
    return match;
  }
}

module.exports = {
  Spec,
  findMatchingSpec
};

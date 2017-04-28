'use strict';
const _ = require('lodash');

/**
 * Class representing an Artifact. It stores the build information of a component
 * @namespace Blacksmith.BuildManager.Artifact
 * @class
 * @param {Object} [data] - Build data
 * @param {Object} [data.metadata] - Metadata of the component
 * @param {string} [data.prefix] - Build prefix
 * @param {Object} [data.source] - Tarball with the source code used information
 * @param {string} [data.buildTime] - Time taken to build the artifact
 * @param {Object} [data.pick] - Files to include in the resulting tarball
 * @param {Object} [data.compiledTarball] - Object containing the path and the sha256 of the resulting tarball
 * @param {Array} [data.runtimePackages] - Array with the list of system packages linked with the artifact binaries
 * @property {Object} metadata - Object containing ID and version of the artifact
 * @property {string} builtOn - Date of the build
 * @property {string} prefix - Build prefix
 * @property {string} source - Source tarball information
 * @property {string} source.tarball - Tarball with the source code used
 * @property {string} source.sha256 - SHA256 of the source tarball
 * @property {string} buildTime - Time taken to build the artifact
 * @property {string} pick - Files included in the resulting tarbal
 * @property {Object} compiledTarball - Object containing the path and the sha256 of the resulting tarball
 * @property {Array} runtimePackages - Array with the list of system packages linked with the artifact binaries
 */
class Artifact {
  constructor(data) {
    data = _.defaults({}, data, {
      metadata: null,
      prefix: null,
      source: null,
      buildTime: null,
      pick: [],
      exclude: [],
      compiledTarball: {
        path: null,
        sha256: null
      },
      systemRuntimeDependencies: []
    });
    this.builtOn = new Date();
    _.extend(this, _.pick(data, [
      'metadata',
      'prefix',
      'source',
      'pick',
      'exclude',
      'compiledTarball',
      'systemRuntimeDependencies'
    ]));
  }
}

module.exports = Artifact;

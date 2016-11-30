'use strict';
const _ = require('nami-utils/lodash-extra');

/**
 * Class representing an Artifact. It stores the build information of a component
 * @namespace Blacksmith.BuildManager.Artifact
 * @class
 * @param {Object} [data] - Build data
 * @param {Object} [data.metadata] - Metadata of the component
 * @param {string} [data.prefix] - Build prefix
 * @param {string} [data.mainLicense] - Component main license
 * @param {string} [data.sourceTarball] - Tarball with the source code used
 * @param {string} [data.buildTime] - Time taken to build the artifact
 * @param {Object} [data.pick] - Files to include in the resulting tarball
 * @param {Object} [data.compiledTarball] - Object containing th epath and the sha256 of the resulting tarball
 * @property {Object} metadata - Object containing ID and version of the artifact
 * @property {string} builtOn - Date of the build
 * @property {string} prefix - Build prefix
 * @property {string} mainLicense - Component main license
 * @property {string} sourceTarball - Tarball with the source code used
 * @param {Object} [pick] - Files included in the resulting tarball
 * @param {string} buildTime - Time taken to build the artifact
 * @param {Object} compiledTarball - Object containing th epath and the sha256 of the resulting tarball
 */
class Artifact {
  constructor(data) {
    data = _.opts(data, {
      metadata: null,
      prefix: null,
      mainLicense: null,
      sourceTarball: null,
      buildTime: null,
      pick: [],
      exclude: [],
      compiledTarball: {
        path: null,
        sha256: null
      },
      parentClass: null
    });
    const metadata = data.metadata;
    this.builtOn = new Date();
    this.metadata = _.pick(metadata, ['id', 'version']);
    _.extend(this, _.pick(data, ['prefix', 'mainLicense', 'sourceTarball', 'compiledTarball', 'parentClass', 'exclude']));
    if (!_.isEmpty(data.pick)) {
      this.pick = data.pick;
    }
  }
}

module.exports = Artifact;

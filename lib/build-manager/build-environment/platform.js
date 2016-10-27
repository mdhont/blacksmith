'use strict';

const os = require('os');
const _ = require('nami-utils/lodash-extra');

/**
 * Class representing a build environment platform
 * @namespace Blacksmith.BuildEnvironment.Platform
 * @class
 * @param {Object} [parameters]
 * @param {Object} [parameters.os] - OS of the platform (calculated by default)
 * @param {Object} [parameters.arch] - Architecture of the platform (calculated by default)
 */
class Platform {
  constructor(parameters) {
    parameters = parameters || {};
    _.assign(this, {
      arch: os.arch(),
      os: os.platform()
    }, parameters || {});
    _.each(['distro', 'version'], p => {
      if (!_.isEmpty(parameters[p])) this[p] = parameters[p];
    });
  }

  /**
   * Override toString method to return `os-arch[-other1-other2]` using platform properties (ordered alphabetically)
   * @function Blacksmith.BuildEnvironment.Platform~toString
   */
  toString() {
    let result = `${this.os}-${this.arch}`;
    _.each(['distro', 'version'], p => {
      if (!_.isEmpty(this[p])) result += `-${this[p]}`;
    });
    return result;
  }
}

module.exports = Platform;

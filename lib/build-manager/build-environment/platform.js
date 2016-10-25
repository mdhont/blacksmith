'use strict';

const os = require('os');
const _ = require('nami-utils/lodash-extra');

/**
 * Class representing a build environment platform
 * @namespace Blacksmith.BuildEnvironment.Platform
 * @class
 * @param {Object} [parameters]
 * @param {Object} [options.os] - OS of the platform
 * @param {Object} [options.arch] - Architecture of the platform
 */
class Platform {
  constructor(parameters) {
    parameters = _.defaults(parameters || {}, {
      arch: os.arch(),
      os: os.platform()
    });
    _.each(parameters, (v, k) => this[k] = v);
  }

  /**
   * Override toString method to return `os-arch[-other1-other2]` using platform properties (ordered alphabetically)
   * @function Blacksmith.BuildEnvironment.Platform~toString
   */
  toString() {
    let result = `${this.os}-${this.arch}`;
    const otherKeys = _.pull(_.keys(this), 'os', 'arch');
    if (otherKeys) result += `${_.map(_.sortBy(otherKeys), k => `-${k}`)}`;
    return result;
  }
}

module.exports = Platform;

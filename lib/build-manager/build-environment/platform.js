'use strict';

const nfile = require('nami-utils').file;
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
      os: os.platform(),
      distro: nfile.ini.get('/etc/os-release', null, 'ID')
    }, parameters || {});
    if (!_.isEmpty(parameters.version)) this.version = parameters.version;
  }

  /**
   * Override toString method to return `os-arch-distro[-version]` using platform properties
   * @function Blacksmith.BuildEnvironment.Platform~toString
   */
  toString() {
    let result = `${this.os}-${this.arch}-${this.distro}`;
    if (!_.isEmpty(this.version)) result += `-${this.version}`;
    return result;
  }
}

module.exports = Platform;

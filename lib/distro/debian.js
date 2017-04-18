'use strict';

const _ = require('nami-utils/lodash-extra');
const Distro = require('./distro.js');

/**
 * Interface representing a Debian Distro
 * @namespace BitnamiContainerizedBuilder.ImageProvider.Debian
 * @extends BitnamiContainerizedBuilder.ImageProvider.Distro
 * @class
 * @param {string} image - Docker image of the distro
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger
 * @property {Object} logger - Logger
 * @property {Object} image - Docker image of the distro
 * @property {Object} packageManagement - Package management tool of the distro
 */
class Debian extends Distro {
  constructor(image, options) {
    super(image, options);
    this._packageManagementTool = 'apt-get';
    this._pkgProviderCommand = ['dpkg', '-S'];
  }
  _versionRegexp(pkg) {
    return new RegExp(`Package:\\s*${this._escapeRegExp(pkg)}\\s*\\nVersions:\\s*\\n([^\\s]*)`, 'm');
  }
  installCommand(pkgs) {
    return `${this._packageManagementTool} install -y --no-install-recommends ${_.flatten([pkgs]).join(' ')}`;
  }
  _getPkgNameFromDescriptor(descriptor) {
    return descriptor.split(':')[0];
  }
}

module.exports = Debian;

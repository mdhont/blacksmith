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
class Centos extends Distro {
  constructor(image, options) {
    super(image, options);
    this._packageManagementTool = 'yum';
    this._pkgProviderCommand = ['rpm', '-qf'];
  }
  _versionRegexp(pkg) {
    return new RegExp(
      `Available Packages\\s*\\nName\\s*:\\s*${this._escapeRegExp(pkg)}\\s*\\n(?:.*:.*\\n)*Version\\s*:\\s*(.*)`,
      'm'
    );
  }
  installCommand(pkgs) {
    return `${this._packageManagementTool} install -y ${_.flatten([pkgs]).join(' ')}`;
  }
  _getPkgNameFromDescriptor(descriptor) {
    return descriptor.match(/(.*?)-[0-9]/m)[1];
  }
}

module.exports = Centos;

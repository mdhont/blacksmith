'use strict';

const Centos = require('./centos.js');

/**
 * Interface representing a Photon Distro
 * @namespace BitnamiContainerizedBuilder.ImageProvider.Photon
 * @extends BitnamiContainerizedBuilder.ImageProvider.Centos
 * @class
 * @param {string} image - Docker image of the distro
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger
 * @property {Object} logger - Logger
 * @property {Object} image - Docker image of the distro
 * @property {Object} packageManagement - Package management tool of the distro
 */
class Photon extends Centos {
  constructor(image, options) {
    super(image, options);
    this._packageManagementTool = 'tdnf';
    // 'rpm' is still used as pkgProvider
  }
}

module.exports = Photon;

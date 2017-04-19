'use strict';

const _ = require('lodash');
const ImageRegistry = require('./image-registry');
const ImageBuilder = require('./image-builder');
const Logger = require('nami-logger');
const ncrypt = require('nami-utils').crypt;
const nfile = require('nami-utils').file;

/**
 * Class representing the Image Provider
 * @namespace Blacksmith.ContainerizedBuilder.ImageProvider
 * @class
 * @param {Array} baseImages - Base Docker Images to use
 * @param {Object} [options]
 * @param {string} [options.registryFile] - Path to a files used as image registry
 * @param {Object} [options.logger] - Logger to use
 */
class ImageProvider {
  constructor(baseImages, options) {
    options = _.defaults({}, options, {
      registryFile: nfile.join(__dirname, 'registry.json'),
      logger: new Logger()
    });
    this.logger = options.logger || new Logger();
    this.imageBuilder = new ImageBuilder(
      baseImages,
      {logger: this.logger}
    );
    this.imageRegistry = new ImageRegistry(options.registryFile, {logger: this.logger});
    // Adding base images to the registry
    _.each(baseImages, image => this.imageRegistry.add(image.id, image.buildTools, image.platform));
  }

  _validateRequirements(requirements) {
    _.each(requirements, req => {
      if (_.isEmpty(req.id) || _.isEmpty(req.type)) {
        throw new Error(
          `You should specify at least an id and type for each build requirement. ` +
          `Received: ${JSON.stringify(req)}`
        );
      }
      if (req.type !== 'system' && _.isEmpty(req.installCommands)) {
        throw new Error(
          `For build requirements with a custom type you need to specify the commands to install them. ` +
          `Received ${req.type} but no installCommands`
        );
      }
    });
  }

  // Returns an unique ID based on the existing resources and the platform of the image
  _getImageId(tools, platform) {
    const environmentID = ncrypt.md5(JSON.stringify(tools));
    return `blacksmith-buildpack-${environmentID}` +
      `-${platform.os}-${platform.arch}-${platform.distro}-${platform.version}`;
  }

  _filterRequirements(list, platform) {
    const platformRequirements = _.filter(list, req => req.type !== 'system' || req.distro === platform.distro);
    return _.uniqBy(platformRequirements, 'id');
  }

  /**
   * Returns a image id that satisfies the given requirements for the given platform
   * @param {Array|Object} [requirements] - Array or object with the requirements of the image
   * @param {Object} [platform] - Platform for the required image
   * @param {Object} [options]
   * @param {string} [options.buildDir] - Directory to place build files
   * @example
   * getImage([
   *    {'type': 'system', 'id': 'zlib1g'},
   *    {'type': 'nami', 'id': 'ruby', 'installCommands': 'bitnami-pkg install ruby'}
   *  ],
   *  {os: 'linux', distro: 'debian'});
   * // => 'debian-buildpack-abcdef12345'
   */
  getImage(requirements, platform, options) {
    options = _.defaults({}, options, {buildDir: null});
    let image = null;
    this._validateRequirements(requirements);
    const platformRequirements = this._filterRequirements(requirements, platform);
    // Look for a cached image satisfying the requirements
    image = this.imageRegistry.getImage(platformRequirements, platform);
    if (!image) {
      // Build a new image
      const imageId = this._getImageId(platformRequirements, platform);
      const imageProperties = this.imageBuilder.build(
        imageId,
        platformRequirements,
        platform,
        {buildDir: options.buildDir}
      );
      image = imageProperties.id;
      // Save the image built in the registry
      this.imageRegistry.add(image, imageProperties.buildTools, platform);
    }
    return image;
  }
}

module.exports = ImageProvider;

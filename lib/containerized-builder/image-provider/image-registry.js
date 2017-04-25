'use strict';

const _ = require('nami-utils/lodash-extra');
const docker = require('docker-utils');
const Logger = require('nami-logger');
const nfile = require('nami-utils').file;

/**
 * Class representing a local registry of Docker Images
 * @class
 * @param {string} registryFile - Path to the file to store the registry
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger to use
 */
class ImageRegistry {
  constructor(registryFile, options) {
    options = _.defaults({}, options, {logger: new Logger()});
    this._registryFile = registryFile;
    if (nfile.exists(registryFile)) {
      this._images = JSON.parse(nfile.read(registryFile));
    } else {
      this._images = [];
      nfile.write(this._registryFile, JSON.stringify(this._images));
    }
    this.logger = options.logger;
  }

  get images() {
    return this._images;
  }

  _satisfyRequirements(tools, requirements) {
    const result = _.every(requirements, requirement => {
      // Look for a resource that satisfies the requirement
      return _.some(tools, tool => tool.id === requirement.id);
    });
    return result;
  }

  /**
   * Removes an image from the registry
   * @param {string} imageID - ID of the image to remove
   */
  remove(imageId) {
    const image = _.find(this._images, {id: imageId});
    if (image) {
      _.pull(this._images, image);
      nfile.write(this._registryFile, JSON.stringify(this._images, null, 2));
    } else {
      this.logger.warn(`Trying to remove from registry non-existent image ${imageId}`);
    }
  }

  /**
   * Adds an image to the registry
   * @param {string} imageID - ID of the image to remove
   * @param {Array} tools - Array of tools available in the image
   * @param {Object} platform - Platform properties of the image
   */
  add(id, tools, platform) {
    const existingImage = _.find(this._images, {id: id});
    if (existingImage) {
      if (_.eq(existingImage.buildTools, tools) && _.eq(existingImage.platform, platform)) {
        this.logger.debug(`Image ${id} already exists in the image registry`);
      } else {
        throw new Error('Conflict between images in registry found');
      }
    } else {
      this._images.push({
        id: id,
        buildTools: tools,
        platform: platform
      });
      nfile.write(this._registryFile, JSON.stringify(this._images, null, 2));
    }
  }

  /**
   * Get an image from the registry
   * @param {Array} [requirements] - Requirements that the image should meet
   * @param {Object} [platform] - Platform to satisfy
   * @returns {string} - Image id or null if any image meet the requirements
   * @example
   * getImage([{ 'type': 'system', 'id': 'zlib1g'}], {os: 'linux', distro: 'debian', version: '8'});
   * // => 'debian-buildpack'
   */
  getImage(requirements, platform) {
    let result = null;
    this.logger.debug(`Trying to find a cached image that satisfies the requirements`);
    const imagesToEvaluate = _.isEmpty(platform) ? this._images : _.filter(this._images, {platform});
    if (!_.isEmpty(requirements)) {
      _.each(imagesToEvaluate, image => {
        const requirementsSatisfied = this._satisfyRequirements(image.buildTools, requirements);
        if (requirementsSatisfied) {
          this.logger.debug(`Found a valid image: ${image.id}. Checking availability`);
          if (docker.imageExists(image.id)) {
            result = image;
            return;
          } else {
            // The image doesn't exist locally, trying to pull it
            try {
              this.logger.debug(`Image ${image.id} not found locally, trying to pull it`);
              docker.pull(image.id);
              result = image;
              return;
            } catch (e) {
              // The image doesn't exists, removing it from the registry and keep looking
              this.logger.debug(`Unable to use ${image.id}, removing the image from the registry`);
              this.remove(image.id);
            }
          }
        }
      });
    } else {
      // If there is no requirements just returns the first image available
      result = _.find(imagesToEvaluate, image => {
        if (docker.imageExists(image.id)) {
          return true;
        } else {
          try {
            docker.pull(image.id);
            return true;
          } catch (e) {
            // Image not exists
            this.remove(image.id);
            return false;
          }
        }
      });
    }
    if (result) {
      this.logger.debug(`Using cached image: ${result.id}`);
      return result.id;
    } else {
      this.logger.debug(`Not found any image satisfying the build requirements`);
      return null;
    }
  }
}

module.exports = ImageRegistry;

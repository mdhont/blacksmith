'use strict';

const _ = require('lodash');

/**
 * @namespace Blacksmith.ContainerizedBuilder.utilities
 */
function _validateImages(images) {
  _.each(images, image => {
    if (!_.isPlainObject(image) || _.isEmpty(image.id)) {
      throw new Error(`You should specify an object with at least an ID. Found ${JSON.stringify(image)}`);
    }
  });
}

/**
 * Returns an image ID of a set of images that satisfies the specified platform
 * @function Blacksmith.ContainerizedBuilder.utilities~getImage
 * @param {Array} images - Images to evaluate. Each image should be an Object containing at least an ID and optionally
 * a boolean indicating if it is the default image and a platform description
 * @param {Object} [platform] - Platform description indicating the requirements of the image
 * @returns {string} - Image ID
 * @example
 * getImage([
 *  {
 *    "id": "myImage1",
 *    "platform": {
 *      "os": "linux",
 *      "arch": "x64"
 *    },
 *    "default": true
 *  }, {
 *    "id": "myImage2",
 *    "platform": {
 *      "os": "linux",
 *      "arch": "x86"
 *    }
 *  }], {"os": "linux", "arch": "x64"})
 * // => 'myImage1'
 */
function getImage(images, platform) {
  let image = null;
  images = _.flatten([images]);
  _validateImages(images);
  if (images.length === 1) {
    if (platform && (_.isEmpty(images[0].platform) || _.some(platform, (v, k) => images[0].platform[k] !== v))) {
      throw new Error(`Image ${JSON.stringify(images[0])} doesn't satisfy ` +
      `the requirements ${JSON.stringify(platform)}`);
    }
    image = images[0];
  } else {
    if (!platform) {
      image = _.find(images, {default: true});
      if (!image) throw new Error('You should mark one of the available images as "default"');
    } else {
      image = _.find(images, {platform});
      if (!image) throw new Error(`Not found any image that satisfies ${JSON.stringify(platform)}`);
    }
  }
  return image.id;
}

module.exports = {
  getImage
};

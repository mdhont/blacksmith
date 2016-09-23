'use strict';
const path = require('path');

const MakeComponent = require('./make-component.js');
/**
 * Class representing a Library
 * @namespace BaseComponents.Library
 * @class
 * @extends MakeComponent
 */
class Library extends MakeComponent {
  /**
  * Get build prefix. By default it will be the environment prefix plus a folder 'common'
  * @returns {mixed}
  */
  get prefix() {
    return path.join(this.be.prefixDir, 'common');
  }
}

module.exports = Library;

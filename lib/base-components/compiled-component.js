'use strict';

const nfile = require('nami-utils').file;
const Component = require('./component');

/**
 * Class representing a CompiledComponent
 * @namespace BaseComponents.CompiledComponent
 * @class
 * @extends Component
 */
class CompiledComponent extends Component {
  /**
   * Copy extrated files to component prefix
   * @function BaseComponents.CompiledComponent~install
   */
  install() {
    nfile.mkdir(this.prefix);
    nfile.copy(nfile.join(this.srcDir, '*'), this.prefix);
  }
}
module.exports = CompiledComponent;

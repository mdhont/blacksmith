'use strict';

const _ = require('nami-utils/lodash-extra');
const cutils = require('compilation-utils');
const CompilableComponent = require('./compilable-component');

/**
* Class representing a Compilable Component
* @namespace BaseComponents.MakeComponent
* @class
* @extends Component
* @param {Object} metadata - {@link Recipe} metadata
* @param {Object} [options]
* @param {Object} [options.logger] - Logger to use
* @property {boolean} supportsParallelBuild=true - Supports compilation using more than one job
* @property {number} maxParallelJobs=Infinity - Maximum number of parallel jobs
* @property {boolean} noDoc=true - Remove documentation from result
*/
class MakeComponent extends CompilableComponent {
  constructor(id, version, source, metadata, options) {
    super(id, version, source, metadata, options);
    this.supportsParallelBuild = true;
  }
  /**
   * Setup the Component environment including max parallel jobs
   * @function BaseComponents.Component~setup
   * @param {Object} be - {@link Blacksmith.BuildEnvironment}
   * @param {Object} [options]
   * @param {Object} [options.logger] - Logger to use
   */
  setup(componentList, be, options) {
    super.setup(componentList, be, options);
    this.maxParallelJobs = this.be.maxParallelJobs || Infinity;
  }
  /**
  * Execute configure and make
  * @function BaseComponents.MakeComponent~build
  */
  build() {
    this.configure();
    this.make();
  }
  /**
  * Execute make install
  * @function BaseComponents.MakeComponent~install
  * @returns Execution output
  */
  install() {
    return this.make('install');
  }
  /**
  * Get Array with configure method flags
  * @function BaseComponents.MakeComponent~configureOptions
  * @returns {mixed}
  */
  configureOptions() {
    return [];
  }
  /**
  * Execute the configure method setting the component prefix and adding the configureOptions
  * @function BaseComponents.MakeComponent~configure
  * @param {Object} [options]
  * @param {string} [options.cwd=this.cwd] - Working directory to run the command
  * @returns Execution output
  */
  configure(options) {
    options = _.opts(options, {cwd: this.workingDir});
    return cutils.configure(options.cwd,
      [`--prefix=${this.prefix}`].concat(this.configureOptions()),
      this._getCmdOpts(options));
  }
  /**
  * Execute the configure method setting the component prefix and adding the configureOptions
  * @function BaseComponents.MakeComponent~make
  * @param {arguments} - Make arguments to use. Can be strings or an object specifying execution options
  * @returns Execution output
  * @example
  * make('global', {abortOnError: false});
  */
  make() {
    let options = {};
    const argList = [];
    if (arguments.length > 0) {
      _.each(_.toArray(arguments), function(arg) {
        if (_.isString(arg)) {
          argList.push(arg);
        } else if (_.isReallyObject(arg)) {
          options = arg;
        }
      });
    }
    options = _.opts(options, {cwd: this.workingDir});
    return cutils.make(options.cwd, argList, this._getCmdOpts(_.extend({
      supportsParallelBuild: this.supportsParallelBuild, maxParallelJobs: this.maxParallelJobs
    }, options)));
  }
}

module.exports = MakeComponent;

'use strict';
const _ = require('nami-utils/lodash-extra');
const nos = require('nami-utils').os;
const Logger = require('nami-logger');
const strftime = require('strftime');
const BuildManager = require('./build-manager');

/**
 * Class representing Blacksmith Builder
 * @namespace Blacksmith
 * @constructor
 * @param {string} config - {@link Blacksmith.ConfigurationHandler Configuration} to use
 * @property {Object} config - {@link Blacksmith.ConfigurationHandler ConfigurationHandler}
 * @property {Object} logger - Blacksmith logger
 * @property {Object} bm - {@link Blacksmith.BuildManager BuildManager}
 * @property {number} exitCode - exit code
 */
class Blacksmith {
  constructor(config) {
    // Configuration Initialization
    this.config = config;
    this.exitCode = 0;
    this.logger = null;
    this.bm = null;
    this._loadConfig();
  }

  /**
   * Update Blacksmith properties with current configuration
   * @function Blacksmith~reloadConfig
   */
  reloadConfig() {
    this._loadConfig();
  }

  _loadConfig() {
    this.logger = new Logger({
      prefix: 'blacksmith', prefixColor: 'magenta',
      level: this.config.get('logging.logLevel'),
      fileLogLevel: this.config.get('logging.fileLogLevel') || 'trace8',
      logFile: this.config.get('logging.logFile') || nos.getTempFile(strftime('blacksmith_%s.log'))
    });
    this.bm = new BuildManager(this.config, {logger: this.logger});
  }

  /**
   * Build Blacksmith Components
   * @function Blacksmith~build
   * @param {Array|Object} buildData - Array of objects to build or Object including:
   * @param {string} [buildData.platform] - Platform of the build
   * @param {Array} buildData.components - Array of components to build. Each component can be a string or
   * an object defining at least an 'id' (it can also include patches or additional files)
   * @param {Object} [options]
   * @param {string} [options.abortOnError=true] - Abort the process if an error is found
   * @param {string} [options.forceRebuild=false] - Force the complete build of all components
   * @param {string} [options.incrementalTracking=false] - Create incremental tarballs per component
   * @param {string} [options.contineAt] - Component to continue the build at
   * @param {Object} [options.platform] - Platform of the build
   * @example
   * build(['zlib', 'openssl', 'apache@~2.4']);
   * @example
   * build({
   *   platform: platform: { os: 'linux', architecture: 'x64' },
   *   components:
   *   [ { patches: [], id: 'zlib' },
   *     { patches: [], id: 'bzip2' }
   *     { patches: [], id: 'openssl' },
   *     'apache']
   * });
   */
  build(buildData, options) {
    options = _.opts(options, {abortOnError: true,
      forceRebuild: false, incrementalTracking: false,
      continueAt: null, platform: null
    });
    try {
      this.bm.build(buildData, options);
    } catch (e) {
      this.exitCode = 1;
      throw (e);
    }
  }
}


module.exports = Blacksmith;

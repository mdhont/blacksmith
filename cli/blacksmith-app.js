'use strict';

const _ = require('nami-utils/lodash-extra');
const nfile = require('nami-utils').file;
const ConfigurationHandler = require('../config-handler');
const BlacksmithParser = require('./blacksmith-parser');
const BlacksmithCore = require('blacksmith-core');

/**
 * Class representing the Blacksmith Application client. It reads the default configuration and call
 * {@link BlacksmithParser} to parse its arguments
 * @namespace BlacksmithApp
 * @class
 * @property {Object} blacksmith - {@link Blacksmith} instance
 */
class BlacksmithApp {
  constructor(configFile) {
    let config = null;
    let opts = null;
    if (nfile.exists(configFile)) {
      opts = {configFile};
      config = _.opts(JSON.parse(nfile.read(configFile)), {paths: {}});
      config.paths.rootDir = nfile.dirname(configFile);
    }
    const configHandler = new ConfigurationHandler(config);
    this.blacksmith = new BlacksmithCore(configHandler);
    this._parser = new BlacksmithParser(this.blacksmith, opts);
  }
  run() {
    const args = process.argv.slice(2);
    if (_.isEmpty(args)) {
      this._parser.showHelp();
    } else {
      try {
        this._parser.parse(args, {allowProcessExit: false});
      } catch (e) {
        this.blacksmith.exitCode = 1;
        if (!_.isEmpty(this.blacksmith.logger)) {
          this.blacksmith.logger.error(e.message);
          this.blacksmith.logger.trace(e.stack);
        } else {
          throw e;
        }
      }
    }
  }
}

module.exports = BlacksmithApp;

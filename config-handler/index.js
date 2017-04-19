'use strict';
const _ = require('nami-utils/lodash-extra');
const utils = require('common-utils');

/**
* Class representing Configuration Handler
* @namespace Blacksmith.ConfigurationHandler
* @class
* @param {Object} conf - Object overriding default configuration. Sections allowed: caching,
* logging, compilation, paths (specifying rootDir is mandatory), recipes and commands
* @example
* new ConfigurationHandler({compilation: {maxJobs: 8}});
*/
class ConfigurationHandler {
  constructor(conf) {
    if (_.isUndefined(conf) || _.isUndefined(conf.paths.rootDir)) {
      throw new Error('You should specify at least the path to rootDir');
    }
    this._rootDir = conf.paths.rootDir;
    // Populate with defaultValues
    this._data = this.getDefaulValue();
    this._loadHash(conf);
  }
  getDefaulValue(key) {
    const defaultConf = {
      logging: {
        logLevel: 'info',
        fileLogLevel: null,
        logFile: null
      },
      compilation: {
        maxJobs: null,
        prefix: null
      },
      paths: {
        // Setting it to [] or null will make the BuildEnvironment use the default
        rootDir: this._rootDir,
        output: null,
        sandbox: null,
        logs: null
      },
      componentTypeCollections: [],
      plugins: []
    };
    return _.isEmpty(key) ? defaultConf : _.get(defaultConf, key);
  }
  _loadHash(conf) {
    _.each(conf, (newData, section) => {
      if (_.isUndefined(this._data[section])) this._data[section] = {};
      _.extend(this._data[section], newData);
    });
    this._validate();
  }
  _validate() {
    _.each(['paths.output', 'paths.sandbox', 'compilation.prefix'], key => {
      if (_.isEmpty(this.get(key))) {
        throw new Error(`You should configure the value of ${key} in the configuration file`);
      }
    });
  }
  /**
   * Get a property value from the configuration
   * @function Blacksmith.ConfigurationHandler~get
   * @param {string} key - Key of the property
   * @returns {string} - Value of the property
   * @example
   * get('compilation.maxJobs');
   * // => 8
   */
  get(key) {
    return _.get(this._data, key);
  }
  /**
   * Set a property value in the configuration
   * @function Blacksmith.ConfigurationHandler~set
   * @param {string} key - Key of the property
   * @param {string} value - Value of the property
   * @example
   * set('compilation.maxJobs', 9);
   */
  set(key, value) {
    if (_.has(this._data, key)) {
      _.set(this._data, key, value);
    } else {
      throw new Error(`Unknown configuration key ${key}`);
    }
  }
  /**
   * Load configuration from a file
   * @function Blacksmith.ConfigurationHandler~loadFile
   * @param {string} file - Path to the file with the configuration
   * @param {Object} [defaults] - Default values to use
   * @example
   * loadFile('config.json');
   */
  loadFile(file, defaults) {
    const conf = _.defaults(utils.parseJSONFile(file), defaults);
    this._loadHash(conf);
  }
}

module.exports = ConfigurationHandler;

'use strict';

const _ = require('nami-utils/lodash-extra');

/**
 * Class representing the environment variables handler
 * @namespace Blacksmith.BuildEnvironment.CompilationEnvVarsHandler
 * @class
 * @param {Object} [options]
 * @param {Object} [options.platform] - Build platform
 */
class CompilationEnvVarsHandler {
  constructor(options) {
    options = _.opts(options, {platform: null});
    if (!options.platform) {
      throw new Error('You need to provide a platform to build for');
    }
    this._environmentVars = this._getDefaultEnvVars(options.platform);
  }
  _getDefaultEnvVars(platform) {
    const envVars = {
      CC: 'gcc',
      LD_LIBRARY_PATH: '',
      DYLD_LIBRARY_PATH: '',
      PATH: process.env.PATH
    };
    if (platform.os === 'linux') {
      if (platform.arch === 'x64') {
        envVars.CFLAGS = ['-m64', '-fPIC'];
      } else { // x86
        envVars.CFLAGS = [];
      }
    } else {
      throw new Error(`Platform ${JSON.stringify(platform)} is not supported`);
    }
    // Strip debug symbols
    envVars.CFLAGS.push('-s');
    return envVars;
  }
  /**
   * Add new a new environment variable or combine it if already exists
   * @function Blacksmith.BuildEnvironment.CompilationEnvVarsHandler~addEnvVariable
   * @param {string} name - Environment variable name
   * @param {string} value - Environment variable value
   * @param {Object} [options]
   * @param {string} [options.operation='merge'] - Operation in case the variable already exists. Posible values:
   * auto, merge, append, prepend and replace
   */
  addEnvVariable(name, value, options) {
    options = _.opts(options, {operation: 'merge'});
    this._environmentVars[name] = this.combineEnvVars(name, this._environmentVars[name], value, options);
  }
  /**
   * Add new environment variables
   * @function Blacksmith.BuildEnvironment.CompilationEnvVarsHandler~addEnvVariables
   * @param {Object} vars - Key/value with the variables to add
   * @param {Object} [options]
   * @param {string} [options.operation='merge'] - Operation in case the variable already exists. Posible values:
   * merge, append, prepend and replace
   */
  addEnvVariables(vars, options) {
    _.each(vars, (value, name) => this.addEnvVariable(name, value, options));
  }
  /**
   * Combine two environment variables
   * @function Blacksmith.BuildEnvironment.CompilationEnvVarsHandler~combineEnvVars
   * @param {string} name - Variable name
   * @param {string} oldValue - Previous value
   * @param {string} newValue - New value
   * @param {string} [options.operation='merge'] - Operation in case the variable already exists. Posible values:
   * merge, append, prepend and replace
   */
  combineEnvVars(name, oldValue, newValue, options) {
    options = _.opts(options, {operation: 'auto'});
    let operation = options.operation;
    if (operation === 'auto' && _.include(['LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'PATH'], name)) {
      operation = 'prepend';
    } else {
      operation = 'merge';
    }
    // Type list
    if (_.include(['CFLAGS', 'CPPFLAGS', 'CXXFLAGS', 'LDFLAGS', 'LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'PATH'], name)
    || _.isArray(newValue) || _.isArray(oldValue)) {
      let combinedValue = null;
      oldValue = _.toArrayIfNeeded(oldValue || []);
      const valueList = _.toArrayIfNeeded(newValue);
      switch (operation) {
        case 'merge':
        // We have no preference on where to add it.
          combinedValue = oldValue;
          _.each(valueList, function(element) {
            if (!_.includes(oldValue, element)) {
              combinedValue.unshift(element);
            }
          });
          break;
        case 'append':
          if (!_.last(oldValue) !== newValue) {
            combinedValue = oldValue.concat(newValue);
          }
          break;
        case 'prepend':
          if (!_.first(oldValue) !== newValue) {
            combinedValue = newValue.concat(oldValue);
          }
          break;
        case 'replace':
          combinedValue = newValue;
          break;
        default:
          throw new Error(`Don't know how to handle '${operation}' operation`);
      }
      if (combinedValue !== null) {
        return combinedValue;
      } else {
        return oldValue;
      }
    } else {
      return newValue;
    }
  }
  /**
   * Get current environment variables
   * @function Blacksmith.BuildEnvironment.CompilationEnvVarsHandler~getEnvVariables
   * @param {Object} extraVars - Additional variables to add
   * @param {string} [options.stringify=true] - Stringify the result
   */
  getEnvVariables(extraVars, options) {
    options = _.opts(options, {stringify: true});
    let values = null;
    if (_.isEmpty(extraVars)) {
      values = this._environmentVars;
    } else {
      values = this._environmentVars;
      _.each(extraVars, (value, name) => {
        if (_.has(values, name)) {
          values[name] = this.combineEnvVars(name, this._environmentVars[name], value, {operation: 'prepend'});
        } else {
          values[name] = value;
        }
      });
    }
    if (options.stringify) {
      values = _.transform(values, (result, val, key) => {
        result[key] = this._stringifyEnvironmentVariable(key, val);
      });
    }
    return values;
  }
  /**
   * Reset environment
   * @function Blacksmith.BuildEnvironment.CompilationEnvVarsHandler~resetEnvironmentVariables
   */
  resetEnvironmentVariables() {
    this._environmentVars = this._getDefaultEnvVars();
  }
  _stringifyEnvironmentVariable(name, value) {
    if (_.include(['LD_LIBRARY_PATH', 'DYLD_LIBRARY_PATH', 'PATH'], name)) {
      return _.toArrayIfNeeded(value).join(':');
    } else if (_.include(['CFLAGS', 'CPPFLAGS', 'CXXFLAGS', 'LDFLAGS'], name) || _.isArray(value)) {
      return _.toArrayIfNeeded(value).join(' ');
    } else {
      return value;
    }
  }
}


module.exports = CompilationEnvVarsHandler;

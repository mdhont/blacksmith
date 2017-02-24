'use strict';

const _ = require('lodash');
const path = require('path');
const spawnSync = require('child_process').spawnSync;
const spawn = require('child_process').spawn;
const BlacksmithApp = require('../../cli/blacksmith-app');

class BlacksmithHandler {
  constructor() {
    this._bin = path.join(__dirname, '../../bin/blacksmith');
  }
  _spawnOpts() {
    const env = {};
    _.extend(env, process.env);
    return {env: env};
  }
  exec(argsString, options) {
    const argsArray = ['-c', `${this._bin} ${argsString}`];
    const result = spawnSync('/bin/bash', argsArray, this._spawnOpts());
    return this._processSpawnResult(result, options);
  }
  asyncExec(argsString) {
    const argsArray = ['-c', `${this._bin} ${argsString}`];
    const opts = this._spawnOpts();
    opts.stdio = [process.stdin, 'ignore', process.stderr];
    return spawn('/bin/bash', argsArray, opts);
  }
  javascriptExec(configFile, args) {
    if (_.isString(args)) args = args.split(' ');
    const oldStdoutWrite = process.stdout.write;
    const oldStderrWrite = process.stderr.write;
    const res = {
      stdout: '',
      stderr: ''
    };
    process.stdout.write = (string) => {
      res.stdout += string;
      return true;
    };
    process.stderr.write = (string) => {
      res.stderr += string;
      return true;
    };
    let app = null;
    try {
      app = new BlacksmithApp(configFile, path.join(__dirname, '../../'));
      app.run(args);
    } catch (e) {
      process.stdout.write = oldStdoutWrite;
      process.stderr.write = oldStderrWrite;
      throw e;
    }
    res.code = app.blacksmith.exitCode;
    process.stdout.write = oldStdoutWrite;
    process.stderr.write = oldStderrWrite;
    return res;
  }
  syncSpawn(argsArray, options) {
    const result = spawnSync(
      this._bin,
      this._configArgs.concat(argsArray),
      this._spawnOpts());
    return this._processSpawnResult(result, options);
  }
  _processSpawnResult(result, options) {
    options = _.defaults(options || {}, {abortOnError: true});
    const stdout = result.stdout.toString();
    const stderr = result.stderr.toString();
    const status = result.status;
    if (status !== 0 && options.abortOnError) {
      throw new Error(stderr);
    }
    return {stdout, stderr, status};
  }
}

module.exports = BlacksmithHandler;

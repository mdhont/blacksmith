'use strict';

const _ = require('lodash');
const fs = require('fs');

class DummyConfigHandler {
  constructor(conf) {
    this.conf = conf;
  }
  get(key) {
    return _.get(this.conf, key);
  }
  set(key, value) {
    _.set(this.conf, key, value);
  }
  loadFile(file, defaults) {
    const conf = _.defaults(JSON.parse(fs.readFileSync(file, {encoding: 'utf8'})), defaults);
    this.conf = conf;
  }
}

module.exports = DummyConfigHandler;

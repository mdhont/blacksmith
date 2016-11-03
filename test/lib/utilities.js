'use strict';

const fs = require('fs');
const path = require('path');
const helpers = require('blacksmith-test');

const getBlacksmithInstance = (config, log) => {
  return {
    config: new helpers.DummyConfigHandler(config),
    bm: {
      createBuildEnvironment: () => {}
    },
    logger: helpers.getDummyLogger(log)
  };
};

const createDummyBlacksmith = (test) => {
  fs.mkdirSync(path.join(test.testDir, 'blacksmith'));
  fs.mkdirSync(path.join(test.testDir, 'blacksmith/bin'));
  fs.writeFileSync(path.join(test.testDir, 'blacksmith/bin/blacksmith'), `#!/bin/bash
  echo $@
  exit 0`, {mode: 755});
  return path.join(test.testDir, 'blacksmith');
};

module.exports = {
  getBlacksmithInstance,
  createDummyBlacksmith,
  baseImage: 'gcr.io/bitnami-containers/bitnami-base-buildpack'
};

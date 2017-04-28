'use strict';

const fs = require('fs');
const path = require('path');
const helpers = require('../../helpers');

const getBlacksmithInstance = (config, log) => {
  return {
    config: new helpers.DummyConfigHandler(config),
    bm: {
      createBuildEnvironment: () => {},
      componentProvider: {
        getComponent: (c) => {
          return c;
        }
      }
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
  baseImage: {
    id: 'gcr.io/bitnami-containers/bitnami-base-buildpack',
    platform: {os: 'linux', arch: 'x64', distro: 'debian', version: '8'},
    buildTools: []
  }
};

'use strict';

const log = {};
const bsmock = require('./blacksmith-mock');
const helpers = require('../../helpers');
const ContainerizedBuilder = require('../../../lib/containerized-builder');
const fs = require('fs');
const test = helpers.createTestEnv();
const blacksmithTool = bsmock.createDummyBlacksmith(test);
const config = JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'}));
config.paths.rootDir = blacksmithTool;
const blacksmithInstance = bsmock.getBlacksmithInstance(config, log);
const cb = new ContainerizedBuilder(blacksmithInstance);
cb.dockerShell(test.buildDir, bsmock.baseImage);

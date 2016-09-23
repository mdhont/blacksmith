'use strict';

const log = {};
const utilities = require('./utilities');
const helpers = require('blacksmith-test');
const ContainerizedBuilder = require('../../lib/containerized-builder');
const fs = require('fs');
const test = helpers.createTestEnv();
const blacksmithTool = utilities.createDummyBlacksmith(test);
const config = JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'}));
config.paths.rootDir = blacksmithTool;
const blacksmithInstance = utilities.getBlacksmithInstance(config, log);
const cb = new ContainerizedBuilder(blacksmithInstance);
cb.dockerShell(test.buildDir, utilities.baseImage);

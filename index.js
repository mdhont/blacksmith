'use strict';

const path = require('path');
const metadata = require('./package.json');
const versionUtils = require('version-utils');

versionUtils.checkNodeVersionSatisfies(metadata.engines.node);

const BlacksmithApp = require('./cli/blacksmith-app');
const app = new BlacksmithApp(path.join(__dirname, 'config.json'));
// In case we are working on asynchronous mode this makes the process have the correct exit code.
process.on('exit', () => {
  process.exitCode = app.blacksmith.exitCode !== 0 ? app.blacksmith.exitCode || 1 : 0;
});
app.run();

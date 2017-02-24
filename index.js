'use strict';

const path = require('path');
const metadata = require('./package.json');
const versionUtils = require('version-utils');

versionUtils.checkNodeVersionSatisfies(metadata.engines.node);

const BlacksmithApp = require('./cli/blacksmith-app');
const rootDir = __dirname;
const app = new BlacksmithApp(path.join(__dirname, 'config.json'), rootDir);
// In case we are working on asynchronous mode this makes the process have the correct exit code.
process.on('exit', () => {
  process.exitCode = app.blacksmith.exitCode !== 0 ? app.blacksmith.exitCode || 1 : 0;
});
const args = process.argv.slice(2);
app.run(args);

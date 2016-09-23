'use strict';

const gulp = require('gulp');
const commonTasks = require('bitnami-gulp-common-tasks')(gulp);
const runSequence = require('run-sequence');

const nodeVersion = '6.2.1';

/* CI tasks */

const testFiles = [
  './test/help.js',
  './test/configure.js',
  './test/inspect.js',
  './test/build.js',
  './test/containerized-build.js',
];
const srcFiles = ['index.js', './cli/*.js', './config-handler/*.js'].concat(testFiles);
const testArgs = {sources: srcFiles, tests: testFiles};

commonTasks.test(testArgs);
commonTasks.ci(testArgs);

/* Build tasks */

const buildDir = './build';

commonTasks.bundle({
  buildDir,
  artifactName: 'blacksmith-linux-x64',
  sources: [
    './package.json',
    './config.json',
    './index.js',
    './cli/*.js',
    './config-handler/*.js',
    './bin/**/*'
  ],
  npmRegistry: 'http://npm-repo01.ext.bitnami.net',
  runtime: {
    version: nodeVersion,
    destDir: './runtimes'
  }
});

commonTasks.npm({
  buildDir,
  sources: [
    './index.js',
    './cli/*.js',
    './config-handler/*.js'
  ],
  meta: [
    './bin/**/*',
    './COPYING',
    'README.md'
  ]
});


/* General tasks */

commonTasks['install-node']({version: nodeVersion, destination: './runtimes'});

gulp.task('clean', () => {
  runSequence('test:clean', 'ci-test:clean', 'bundle:clean');
});

gulp.task('default', ['install-node']);

'use strict';

const gulp = require('gulp');
const commonTasks = require('bitnami-gulp-common-tasks')(gulp);
const runSequence = require('run-sequence');

const nodeVersion = '10.19.0';

/* CI tasks */

const testFiles = [
  './test/index.js'
];
const srcFiles = ['index.js', './cli/**/*.js', './config-handler/*.js', './lib/**/*.js'];
const testArgs = {sources: srcFiles, tests: testFiles};

commonTasks.test(testArgs);
commonTasks.ci(testArgs);

/* Build tasks */

const buildDir = './artifacts/build';

commonTasks.bundle({
  buildDir,
  artifactName: 'blacksmith-linux-x64',
  sources: [
    './package.json',
    './config.json.sample',
    './index.js',
    './cli/**/*',
    './config-handler/*.js',
    './schemas/*',
    './lib/**/*',
    './bin/**/*'
  ],
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
    './schemas/*',
    './config-handler/*.js',
    './lib/**/*'
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

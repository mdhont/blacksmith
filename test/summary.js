'use strict';

const Summary = require('../lib/build-manager/artifacts/summary');
const BuildEnvironment = require('../lib/build-manager/build-environment');
const helpers = require('blacksmith-test');
const path = require('path');
const os = require('os');
const _ = require('lodash');
const fs = require('fs');
const crypto = require('crypto');
const spawnSync = require('child_process').spawnSync;
const chai = require('chai');
const chaiFs = require('chai-fs');
const expect = chai.expect;
chai.use(chaiFs);

describe('Summary', () => {
  before('clean environment before start', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  it('creates an instance successfully', () => {
    const result = {
      _fsTracker: null,
      _artifactsDir: null,
      platform: {os: 'linux', arch: 'x64'},
      root: '/tmp/blacksmith_test_env/prefix',
      artifacts: [],
      startTime: process.hrtime()[0],
      endTime: null
    };
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const summary = new Summary(be);
    _.each(result, (v, k) => {
      expect(summary[k]).to.be.eql(v);
    });
    expect(summary._be).to.be.eql(be);
  });
  it('captures the build time', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const summary = new Summary(be);
    summary.start();
    const dt = new Date();
    while ((new Date()) - dt <= 1000); // Wait 1 second synchronously
    summary.end();
    const buildTime = summary.endTime - summary.startTime;
    expect(buildTime).to.be.eql(1);
  });
  it('adds a new Artifact without incrementalTracking', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const summary = new Summary(be);
    fs.writeFileSync(path.join(test.prefix, 'hello'), 'hello');
    const component = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: test.prefix,
      mainLicense: {
        type: 'BSD3',
        licenseRelativePath: 'LICENSE'
      },
      sourceTarball: 'test.tar.gz'
    };
    summary.addArtifact(component);
    const artifact = summary.artifacts[0];
    _.each(component, (v, k) => {
      expect(artifact[k]).to.be.eql(v);
    });
  });
  it('adds a new Artifact with incrementalTracking', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const artifactsDir = path.join(test.buildDir, 'artifacts');
    const summary = new Summary(be, {incrementalTracking: true, artifactsDir});
    fs.writeFileSync(path.join(test.prefix, 'hello'), 'hello');
    const component = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: test.prefix,
      srcDir: test.buildDir
    };
    summary.addArtifact(component);
    /* eslint-disable no-unused-expressions */
    expect(
      path.join(artifactsDir,
        `${component.metadata.id}-${component.metadata.version}-${os.platform()}-${os.arch()}.tar.gz`)
    ).to.be.file;
    /* eslint-enable no-unused-expressions */
  });
  it('compress the resulting artifacts', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const summary = new Summary(be);
    fs.writeFileSync(path.join(test.prefix, 'hello'), 'hello');
    const component = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: test.prefix,
      srcDir: test.buildDir
    };
    summary.addArtifact(component);
    const result = path.join(test.buildDir, 'result.tar.gz');
    summary.compressArtifacts(result);
    expect(result).to.be.file; // eslint-disable-line no-unused-expressions
    expect(spawnSync('tar', ['-ztf', result]).stdout.toString()).to.contain('hello');
  });
  it('compress the resulting artifacts picking just some files', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const summary = new Summary(be);
    fs.writeFileSync(path.join(test.prefix, 'hello'), 'hello');
    fs.writeFileSync(path.join(test.prefix, 'world'), 'world');
    const component = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: test.prefix,
      srcDir: test.buildDir,
      pick: path.join(test.prefix, 'hello')
    };
    summary.addArtifact(component);
    const result = path.join(test.buildDir, 'result.tar.gz');
    summary.compressArtifacts(result);
    expect(result).to.be.file; // eslint-disable-line no-unused-expressions
    expect(spawnSync('tar', ['-ztf', result]).stdout.toString()).to.contain('hello');
    expect(spawnSync('tar', ['-ztf', result]).stdout.toString()).to.not.contain('world');
  });
  it('compress with incrementalTracking', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    // Creates a new file that doesn't belong to the build
    fs.writeFileSync(path.join(test.prefix, 'hello'), 'hello');
    const artifactsDir = path.join(test.buildDir, 'artifacts');
    const summary = new Summary(be, {incrementalTracking: true, artifactsDir});
    fs.writeFileSync(path.join(test.prefix, 'world'), 'world');
    const component = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: test.prefix,
      srcDir: test.buildDir
    };
    summary.addArtifact(component);
    const result = path.join(test.buildDir, 'result.tar.gz');
    summary.compressArtifacts(result);
    expect(result).to.be.file; // eslint-disable-line no-unused-expressions
    expect(spawnSync('tar', ['-ztf', result]).stdout.toString()).to.not.contain('hello');
    expect(spawnSync('tar', ['-ztf', result]).stdout.toString()).to.contain('world');
  });
  it('writes a JSON report', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const summary = new Summary(be);
    fs.writeFileSync(path.join(test.prefix, 'hello'), 'hello');
    class Library {}
    class Component extends Library {}
    const component = new Component();
    _.extend(component, {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: test.prefix,
      mainLicense: {
        type: 'BSD3',
        licenseRelativePath: 'LICENSE'
      },
      sourceTarball: 'test.tar.gz',
    });
    summary.addArtifact(component);
    summary.end();
    const expectedResult = {
      'buildTime': 0,
      'prefix': test.prefix,
      platform: {os: 'linux', arch: 'x64'},
      'builtOn': new RegExp(`${new Date().getFullYear()}-.*`)
    };
    const expectedArtifact = {
      'builtOn': new RegExp(`${new Date().getFullYear()}-.*`),
      'metadata': {
        'id': component.metadata.id,
        'version': component.metadata.version
      },
      'prefix': component.prefix,
      'mainLicense': {
        type: 'BSD3',
        licenseRelativePath: 'LICENSE'
      },
      'sourceTarball': 'test.tar.gz',
      'parentClass': 'Library'
    };
    const obtainedResult = JSON.parse(summary.toJson({test: 2}));
    const check = function(toCheck, valid) {
      _.each(valid, (v, k) => {
        if (_.isObject(v) && !_.isRegExp(v)) {
          expect(toCheck[k]).to.be.eql(v);
        } else {
          expect(!!toCheck[k].toString().match(v), 'Malformed JSON').to.be.eql(true);
        }
      });
    };
    check(obtainedResult, expectedResult);
    expect(obtainedResult.artifacts.length).to.be.eql(1);
    check(obtainedResult.artifacts[0], expectedArtifact);
  });
  it('serializes the result', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const summary = new Summary(be, {buildId: 'serialize-test'});
    fs.writeFileSync(path.join(test.prefix, 'hello'), 'hello');
    const component = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: test.prefix,
      mainLicense: {
        type: 'BSD3',
        licenseRelativePath: 'LICENSE'
      },
      sourceTarball: 'test.tar.gz'
    };
    summary.addArtifact(component);
    summary.end();
    summary.serialize(test.buildDir);
    const md5 = crypto.createHash('md5');

    md5.update(fs.readFileSync(path.join(test.buildDir, `serialize-test-${os.platform()}-${os.arch()}.tar.gz`)));
    const resultMD5 = md5.digest('hex');
    const expectedResult = {
      'tarball': `serialize-test-${os.platform()}-${os.arch()}.tar.gz`,
      'md5': resultMD5
    };
    const result = JSON.parse(
      fs.readFileSync(path.join(test.buildDir, `serialize-test-${os.platform()}-${os.arch()}-build.json`)).toString()
    );
    expect(_.pick(result, ['tarball', 'md5'])).to.be.eql(expectedResult);
  });
  it('serializes the result with a custom platform', () => {
    const test = helpers.createTestEnv();
    const be = new BuildEnvironment({
      sourcePaths: [test.assetsDir],
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox,
      platform: {os: 'linux', arch: 'x86', distro: 'debian'}
    });
    const summary = new Summary(be);
    fs.writeFileSync(path.join(test.prefix, 'hello'), 'hello');
    const component = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: test.prefix,
      srcDir: test.buildDir
    };
    summary.addArtifact(component);
    summary.end();
    summary.serialize(test.buildDir);
    expect(  // eslint-disable-line no-unused-expressions
      path.join(test.buildDir, `${component.id}-${component.version}-linux-x86-debian.tar.gz`)
    ).to.be.file;
  });
});

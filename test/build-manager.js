'use strict';

const BuildManager = require('../lib/build-manager');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const helpers = require('blacksmith-test');
const DummyConfigHandler = helpers.DummyConfigHandler;
const chai = require('chai');
const chaiFs = require('chai-fs');
const expect = chai.expect;
chai.use(chaiFs);

describe('Build Manager', () => {
  before('prepare environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  it('creates an instance successfully', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    expect(bm.config.conf).to.be.eql(config.conf);
    expect(bm.logger).to.not.be.empty; // eslint-disable-line no-unused-expressions
    expect(bm.componentProvider).to.not.be.empty; // eslint-disable-line no-unused-expressions
  });
  it('obtains component metadata', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    const component = helpers.createComponent(test);
    const desiredResult = {
      platform: 'linux-x64',
      flavor: null,
      components: [
        {
          sourceTarball: `${test.assetsDir}/${component.id}-${component.version}.tar.gz`,
          patches: [],
          extraFiles: [],
          version: component.version,
          id: component.id
        }
      ]
    };
    const metadata = bm.getComponentsMetadata([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ]);
    expect(metadata).to.be.eql(desiredResult);
  });
  it('modifies platform from metadata', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    const component = helpers.createComponent(test);
    const metadata = bm.getComponentsMetadata([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ], {platform: 'linux'});
    expect(metadata.platform).to.be.eql('linux');
  });
  it('modifies flavor from metadata', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    const component = helpers.createComponent(test);
    const metadata = bm.getComponentsMetadata([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ], {flavor: 'alpine'});
    expect(metadata.flavor).to.be.eql('alpine');
  });
  it('obtains component based on object', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    const component = helpers.createComponent(test);
    const desiredResult = {
      platform: 'linux',
      flavor: 'alpine',
      components: [
        {
          sourceTarball: path.join(test.assetsDir, `${component.id}-${component.version}.tar.gz`),
          patches: [],
          extraFiles: [],
          version: component.version,
          id: component.id
        }
      ]
    };
    const metadata = bm.getComponentsMetadata(desiredResult);
    expect(metadata).to.be.eql(desiredResult);
  });
  it('creates a BuildEnvironment with the default data', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    const defaultConfig = {
      'platform': 'linux-x64',
      'flavor': null,
      'outputDir': test.testDir,
      'prefixDir': test.prefix,
      'maxParallelJobs': Infinity,
      'sandboxDir': test.sandbox,
      'artifactsDir': null,
      'logsDir': path.join(test.testDir, 'logs'),
      'target': {
        'platform': 'linux-x64',
        'flavor': null,
        'arch': 'x64',
        'isUnix': true
      }
    };
    bm.createBuildEnvironment();
    _.each(defaultConfig, (v, k) => expect(bm.be[k]).to.be.eql(v));
  });
  it('creates a BuildEnvironment with modified options', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config);
    bm.createBuildEnvironment({platform: 'linux', flavor: 'alpine'});
    const modifiedTarget = {
      'platform': 'linux',
      'flavor': 'alpine',
      'arch': 'x86',
      'isUnix': true
    };
    expect(bm.be.target).to.be.eql(modifiedTarget);
  });
  it('builds a sample package', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger(log)});
    const component = helpers.createComponent(test);
    bm.build([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ]);
    expect(log.text).to.contain(`Build completed. Artifacts stored under '${test.testDir}`);
  });
  it('forces the rebuild', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger(log)});
    bm.build([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ]);
    bm.build([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ], {forceRebuild: true});
    expect(log.text).to.not.contain('Skipping build step');
  });
  it('builds a sample package modifying platform and flavor', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger(log)});
    bm.build([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ], {platform: 'linux', flavor: 'alpine'});
    const modifiedTarget = {
      'platform': 'linux',
      'flavor': 'alpine',
      'arch': 'x86',
      'isUnix': true
    };
    expect(bm.be.target).to.be.eql(modifiedTarget);
    expect(log.text).to.contain('Building for target {"platform":"linux","flavor":"alpine"}');
  });
  it('continues at a different component', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const component2 = helpers.createComponent(test, {id: 'sample2'});
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger(log)});
    bm.build([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`,
      `${component2.id}:${test.assetsDir}/${component2.id}-${component2.version}.tar.gz`
    ], {continueAt: component2.id});
    expect(log.text).to.contain(
      `Skipping component ${component.id} ${component.version} because of continueAt=${component2.id}`
    );
  });
  it('uses incrementalTracking and buildDir', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger()});
    bm.build([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ], {incrementalTracking: true, buildDir: test.buildDir});
    expect(
      path.join(test.buildDir, 'artifacts/components', `${component.id}-${component.version}-linux-x64.tar.gz`)
    ).to.be.file();
  });
  it('setup the buildId', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bm = new BuildManager(config, {logger: helpers.getDummyLogger()});
    bm.build([
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`
    ], {buildDir: test.buildDir, buildId: 'blacksmith-test'});
    expect(
      path.join(test.buildDir, 'artifacts/blacksmith-test-linux-x64.tar.gz')
    ).to.be.file();
  });
});

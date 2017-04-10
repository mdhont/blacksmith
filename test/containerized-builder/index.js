'use strict';

const helpers = require('../helpers');
const ContainerizedBuilder = require('../../lib/containerized-builder');
const chai = require('chai');
const spawnSync = require('child_process').spawnSync;
const spawn = require('child_process').spawn;
const bsmock = require('./helpers/blacksmith-mock');
const fs = require('fs');
const path = require('path');
const expect = chai.expect;

describe('Containerized Builder', function() {
  this.timeout(30000);
  beforeEach('prepare environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  require('./utilities');
  it('creates an instance successfully', () => {
    const cb = new ContainerizedBuilder(bsmock.getBlacksmithInstance());
    expect(cb.logger).to.not.be.empty; // eslint-disable-line no-unused-expressions
    expect(cb.config).to.not.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('builds a component', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const blacksmithTool = bsmock.createDummyBlacksmith(test);
    const config = JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'}));
    config.paths.rootDir = blacksmithTool;
    const blacksmithInstance = bsmock.getBlacksmithInstance(config, log);
    const cb = new ContainerizedBuilder(blacksmithInstance);
    cb.build(
      [`${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`],
      bsmock.baseImage,
      {
        buildDir: test.buildDir,
        exitOnEnd: false
      }
    );
    expect(log.text).to.contain('Command successfully executed');
  });

  it('propagates the correct options', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const blacksmithTool = bsmock.createDummyBlacksmith(test);
    const config = JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'}));
    config.metadataServer = {activate: true, prioritize: true, endPoint: 'test'};
    config.paths.rootDir = blacksmithTool;
    const blacksmithInstance = bsmock.getBlacksmithInstance(config, log);
    const cb = new ContainerizedBuilder(blacksmithInstance);
    cb.build(
      component.buildSpec,
      bsmock.baseImage,
      {
        buildDir: test.buildDir,
        forceRebuild: false,
        containerRoot: path.join(test.buildDir, 'root'),
        continueAt: component.id,
        incrementalTracking: true,
        exitOnEnd: false
      }
    );
    // Validate parameters
    expect(log.text).to.contain(`--config /opt/blacksmith/config/config.json`);
    expect(log.text).to.contain(`--continue-at=${component.id}`);
    expect(log.text).to.contain(`--incremental-tracking`);
    // Validate config and component content
    const configRes = JSON.parse(fs.readFileSync(path.join(test.buildDir, 'config/config.json')));
    const desiredConf = {
      logging: {logFile: '/tmp/logs/build.log'},
      paths: {
        output: '/opt/blacksmith/output',
        logs: '/tmp/logs',
        sandbox: test.sandbox,
        recipes: [test.componentDir]
      },
      compilation: {prefix: test.prefix},
      metadataServer: config.metadataServer,
      containerizedBuild: {
        images: [{id: bsmock.baseImage}]
      }
    };
    expect(configRes).to.be.eql(desiredConf);
    const buildSpec = JSON.parse(fs.readFileSync(path.join(test.buildDir, 'config/containerized-build.json')));
    expect(buildSpec.components).to.be.eql([{
      'extraFiles': [],
      'id': 'sample1',
      'patches': [],
      'sourceTarball': `/tmp/sources/${path.basename(component.sourceTarball)}`
    }]);
  });

  it('cannot allow to force the rebuild and continue at some point', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'}));
    const blacksmithInstance = bsmock.getBlacksmithInstance(config, log);
    const cb = new ContainerizedBuilder(blacksmithInstance);
    expect(() => cb.build(
      [`${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`],
      bsmock.baseImage,
      {
        buildDir: test.buildDir,
        forceRebuild: true,
        containerRoot: path.join(test.buildDir, 'root'),
        continueAt: component.id,
        incrementalTracking: true,
        exitOnEnd: false
      }
    )).to.throw('You cannot use --force-rebuild and --continue-at in the same build');
  });

  it('parses component properties as an object', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const blacksmithTool = bsmock.createDummyBlacksmith(test);
    const config = JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'}));
    config.metadataServer = {activate: true, prioritize: true, endPoint: 'test'};
    config.paths.rootDir = blacksmithTool;
    const blacksmithInstance = bsmock.getBlacksmithInstance(config, log);
    const cb = new ContainerizedBuilder(blacksmithInstance);
    fs.writeFileSync(path.join(test.buildDir, 'test.patch'), 'PATCH');
    fs.writeFileSync(path.join(test.buildDir, 'test.extra'), 'EXTRA');
    cb.build({
      components: [{
        id: component.id,
        version: component.version,
        sourceTarball: path.join(test.assetsDir, `${component.id}-${component.version}.tar.gz`),
        patches: [path.join(test.buildDir, 'test.patch')],
        extraFiles: [path.join(test.buildDir, 'test.extra')]
      }]
    }, bsmock.baseImage, {
      buildDir: test.buildDir,
      exitOnEnd: false
    });
    const result = JSON.parse(fs.readFileSync(path.join(test.buildDir, 'config/containerized-build.json')));
    const desiredResult = {components: [
      {
        'sourceTarball': `/tmp/sources/${component.id}-${component.version}.tar.gz`,
        'patches': ['/tmp/sources/test.patch'],
        'extraFiles': ['/tmp/sources/test.extra'],
        'id': component.id,
        'version': component.version
      }
    ]};
    expect(result).to.be.eql(desiredResult);
  });

  it('opens a shell', () => {
    const previousENV = Object.assign({}, process.env);
    process.env.NO_TTY = 1;
    spawn('node', [path.join(__dirname, './helpers/shell.js')], { // Opens a spawn process with the shell
      stdio: [process.stdin, 'ignore', process.stderr]
    });
    process.env = previousENV;
    let running = false;
    let retries = 0;
    let blacksmithContainer = null;
    while (!running && retries < 10) { // Wait for the container to start
      const dt = new Date();
      while ((new Date()) - dt <= 5000); // Wait 5 seconds synchronously
      const runningContainers = spawnSync('docker', ['ps']).stdout.toString();
      const printableDate = dt.toISOString().split('T')[0];
      blacksmithContainer = runningContainers.match(new RegExp(`(blacksmith-shell-${printableDate}-[0-9]*)$`, 'm'));
      if (blacksmithContainer) running = true;
      retries++;
    }
    expect(blacksmithContainer).to.not.be.null; // eslint-disable-line no-unused-expressions
    const blacksmithContainerName = blacksmithContainer[1];
    const content = spawnSync('docker', ['exec', blacksmithContainerName, 'ls', '/blacksmith/bin']).stdout.toString();
    spawnSync('docker', ['stop', blacksmithContainerName]);
    spawnSync('docker', ['rm', blacksmithContainerName]);
    expect(content).to.contain('blacksmith');
  });
});

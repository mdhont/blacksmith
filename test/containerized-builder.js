'use strict';

const helpers = require('blacksmith-test');
const ContainerizedBuilder = require('../lib/containerized-builder');
const chai = require('chai');
const spawnSync = require('child_process').spawnSync;
const spawn = require('child_process').spawn;
const utilities = require('./lib/utilities');
const fs = require('fs');
const path = require('path');
const expect = chai.expect;

describe('Containerized Builder', function() {
  this.timeout(30000);
  beforeEach('prepare environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    // helpers.cleanTestEnv();
  });
  it('creates an instance successfully', () => {
    const cb = new ContainerizedBuilder(utilities.getBlacksmithInstance());
    expect(cb.logger).to.not.be.empty; // eslint-disable-line no-unused-expressions
    expect(cb.config).to.not.be.empty; // eslint-disable-line no-unused-expressions
  });

  it('builds a component', () => {
    const log = {};
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const blacksmithTool = utilities.createDummyBlacksmith(test);
    const config = JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'}));
    config.paths.rootDir = blacksmithTool;
    const blacksmithInstance = utilities.getBlacksmithInstance(config, log);
    const cb = new ContainerizedBuilder(blacksmithInstance);
    cb.build(
      [`${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`],
      utilities.baseImage,
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
    const blacksmithTool = utilities.createDummyBlacksmith(test);
    const config = JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'}));
    config.metadataServer = {activate: true, prioritize: true, endPoint: 'test'};
    config.paths.rootDir = blacksmithTool;
    const blacksmithInstance = utilities.getBlacksmithInstance(config, log);
    const cb = new ContainerizedBuilder(blacksmithInstance);
    cb.build(
      [`${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`],
      utilities.baseImage,
      {
        buildDir: test.buildDir,
        forceRebuild: true,
        containerRoot: path.join(test.buildDir, 'root'),
        continueAt: component.name,
        incrementalTracking: true,
        flavor: 'test',
        platform: 'linux',
        exitOnEnd: false
      }
    );
    // Validate parameters
    expect(log.text).to.contain(`--config /opt/blacksmith/config/config.json`);
    expect(log.text).to.contain(`--json /opt/blacksmith/config/components.json`);
    expect(log.text).to.contain(`--platform=linux`);
    expect(log.text).to.contain(`--flavor=test`);
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
      metadataServer: config.metadataServer
    };
    expect(configRes).to.be.eql(desiredConf);
    const components = JSON.parse(fs.readFileSync(path.join(test.buildDir, 'config/components.json')));
    expect(components).to.be.eql([`${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`]);
  });

  it('opens a shell', () => {
    const previousENV = Object.assign({}, process.env);
    process.env.NO_TTY = 1;
    spawn('node', [path.join(__dirname, './lib/shell.js')], { // Opens a spawn process with the shell
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

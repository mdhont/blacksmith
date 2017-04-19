'use strict';

const _ = require('lodash');
const bsmock = require('./helpers/blacksmith-mock');
const ContainerizedBuilder = require('../../lib/containerized-builder');
const chai = require('chai');
const expect = chai.expect;
const fs = require('fs');
const helpers = require('../helpers');
const ImageRegistry = require('../../lib/containerized-builder/image-provider/image-registry');
const path = require('path');
const sinon = require('sinon');
const spawnSync = require('child_process').spawnSync;
const spawn = require('child_process').spawn;


require('./image-provider/image-registry');
require('./image-provider/image-builder');
require('./image-provider/image-provider');
describe('ContainerizedBuilder', function() {
  this.timeout(30000);
  beforeEach(() => {
    helpers.cleanTestEnv();
    sinon.stub(ImageRegistry.prototype, 'add').callsFake(() => true);
    sinon.stub(ImageRegistry.prototype, 'remove').callsFake(() => true);
    sinon.stub(ImageRegistry.prototype, 'getImage').callsFake((reqs) => {
      if (_.isEmpty(reqs)) {
        return bsmock.baseImage.id;
      } else {
        return null;
      }
    });
  });
  afterEach(() => {
    ImageRegistry.prototype.add.restore();
    ImageRegistry.prototype.remove.restore();
    ImageRegistry.prototype.getImage.restore();
    helpers.cleanTestEnv();
  });
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
      component.buildSpec,
      [bsmock.baseImage],
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
      [bsmock.baseImage],
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
        sandbox: test.sandbox,
      },
      compilation: {prefix: test.prefix},
      containerizedBuild: {
        images: [{id: bsmock.baseImage.id}]
      }
    };
    expect(configRes).to.be.eql(desiredConf);
    const buildSpec = JSON.parse(fs.readFileSync(path.join(test.buildDir, 'config/containerized-build.json')));
    expect(buildSpec.components).to.be.eql([{
      'id': component.id,
      'version': component.version,
      'recipeLogicPath': `/tmp/recipes/${component.id}/index.js`,
      'metadata': component.buildSpec.components[0].metadata,
      'source': {
        'tarball': `/tmp/sources/${component.id}/${path.basename(component.source.tarball)}`,
        'sha256': component.source.sha256
      }
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
      component.buildSpec,
      [bsmock.baseImage],
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

  it('parses component properties with patches and extraFiles', () => {
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
        recipeLogicPath: component.recipeLogicPath,
        source: {
          tarball: path.join(test.assetsDir, `${component.id}-${component.version}.tar.gz`),
          sha256: component.source.sha256
        },
        patches: [{path: path.join(test.buildDir, 'test.patch'), sha256: '1234'}],
        extraFiles: [{path: path.join(test.buildDir, 'test.extra'), sha256: '1234'}]
      }],
      platform: {os: 'linux', distro: 'debian'}
    }, [bsmock.baseImage], {
      buildDir: test.buildDir,
      exitOnEnd: false
    });
    const result = JSON.parse(fs.readFileSync(path.join(test.buildDir, 'config/containerized-build.json')));
    const desiredResult = {components: [
      {
        'recipeLogicPath': `/tmp/recipes/${component.id}/index.js`,
        'source': {
          'tarball': `/tmp/sources/${component.id}/${path.basename(component.source.tarball)}`,
          'sha256': component.source.sha256
        },
        'patches': [{path: `/tmp/sources/${component.id}/test.patch`, sha256: '1234'}],
        'extraFiles': [{path: `/tmp/sources/${component.id}/test.extra`, sha256: '1234'}],
        'id': component.id,
        'version': component.version
      }
    ], platform: {os: 'linux', distro: 'debian'}};
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

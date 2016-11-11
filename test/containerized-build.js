'use strict';

/* eslint-disable no-unused-expressions */

const path = require('path');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;
const chai = require('chai');
const chaiFs = require('chai-fs');
const chaiSubset = require('chai-subset');
const expect = chai.expect;
const helpers = require('blacksmith-test');
const BlacksmithHandler = helpers.Handler;

chai.use(chaiSubset);
chai.use(chaiFs);

function _platform(component) {
  return `${component.buildSpec.platform.os}-${component.buildSpec.platform.arch}` +
  `-${component.buildSpec.platform.distro}-${component.buildSpec.platform.version}`;
}

describe('#containerized-build()', function() {
  this.timeout(240000);
  const extraConf = {
    extra: {
      commands: ['blacksmith-containerized-build-command']
    }
  };
  const blacksmithHandler = new BlacksmithHandler();
  beforeEach(helpers.cleanTestEnv);
  afterEach(helpers.cleanTestEnv);
  it('Builds a simple package from CLI', function() {
    const test = helpers.createTestEnv(extraConf);
    const component = helpers.createComponent(test);
    blacksmithHandler.exec(`--config ${test.configFile} ` +
      `containerized-build --build-dir ${test.buildDir} ` +
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`);
    expect(
      path.join(test.buildDir, `artifacts/${component.id}-${component.version}-stack-${_platform(component)}.tar.gz`)
    ).to.be.file();
  });
  it('Propagates the metadata server configureation', function() {
    const metadataServerEndpoint = 'https://test-metadata-server.net/api/v1';
    const metadataServer = {
      activate: false,
      prioritize: true,
      endPoint: metadataServerEndpoint
    };
    const test = helpers.createTestEnv({
      metadataServer,
      extra: {
        commands: ['blacksmith-containerized-build-command']
      }
    });
    const component = helpers.createComponent(test);
    helpers.addComponentToMetadataServer(metadataServerEndpoint, component);
    blacksmithHandler.exec(
      `--config ${test.configFile} --log-level trace containerized-build --build-dir ${test.buildDir} ` +
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`);
    expect(
      path.join(test.buildDir, `artifacts/${component.id}-${component.version}-stack-${_platform(component)}.tar.gz`)
    ).to.be.file();
    expect(
      JSON.parse(fs.readFileSync(path.join(test.buildDir, `config/config.json`), {encoding: 'utf-8'})).metadataServer
    ).to.be.eql(metadataServer);
  });
  it('Builds a simple package from JSON with available options', function() {
    const test = helpers.createTestEnv(extraConf);
    const component = helpers.createComponent(test);
    const jobs = 3;
    const buildResult = blacksmithHandler.exec(`--log-level trace --log-file ${path.join(test.buildDir, 'test.log')} ` +
      `--config ${test.configFile} ` +
      'containerized-build ' +
      `--json ${component.buildSpecFile} ` +
      '--incremental-tracking ' +
      `--prefix ${test.buildDir} ` +
      `--build-dir ${test.buildDir} ` +
      `--max-jobs ${jobs}`);
    // Modifies the build ID
    expect(
      path.join(
        test.buildDir,
        'artifacts',
        `${component.buildSpec['build-id']}-${_platform(component)}.tar.gz`
      )
    ).to.be.file();
    expect(
      path.join(
        test.buildDir,
        'artifacts',
        `${component.buildSpec['build-id']}-${_platform(component)}-build.json`
      )
    ).to.be.file();
    // Basic summary content test
    const summary = JSON.parse(fs.readFileSync(path.join(
      test.buildDir,
      'artifacts',
      `${component.buildSpec['build-id']}-${_platform(component)}-build.json`
    )));
    expect(summary).to.include.keys(['prefix', 'platform', 'artifacts', 'tarball', 'md5']);
    // Modifies the log level
    expect(buildResult.stdout).to.contain('blacksm TRACE ENVIRONMENT VARIABLES');
    // Set the log file
    expect(path.join(test.buildDir, 'test.log')).to.be.file();
    // Modifies the build directory - T12761
    expect(buildResult.stdout).to.contain(`Command successfully executed. Find its results under ${test.buildDir}`);
    // Uses incremental tracking
    expect(path.join(
      test.buildDir, 'artifacts/components', `${component.id}-${component.version}-${_platform(component)}.tar.gz`
    )).to.be.file();
    // Modifies the prefix
    expect(buildResult.stdout).to.contain(`--prefix=${test.buildDir}`);
    // Modifies the maximum number of jobs
    expect(buildResult.stdout).to.contain(`"--jobs=${jobs}"`);
  });
  it('Continues a previous build', function() {
    const test = helpers.createTestEnv(extraConf);
    const component = helpers.createComponent(test);
    const component2 = helpers.createComponent(test, {
      id: 'sample2',
    });
    blacksmithHandler.exec(`--config ${test.configFile} ` +
      `containerized-build --build-dir ${test.buildDir} ` +
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`);
    const continueBuildRes = blacksmithHandler.exec('--log-level trace ' +
      `--config ${test.configFile} ` +
      'containerized-build ' +
      `--json ${component.buildSpecFile} ` +
      `--build-dir ${test.buildDir} ` +
      `--build-id ${component2.id} ` +
      `--continue-at ${component2.id} ` +
      `${component2.id}:${test.assetsDir}/${component2.id}-${component2.version}.tar.gz`);
    expect(continueBuildRes.stdout).
    to.contain(`Skipping component ${component.id} ${component.version} because of continueAt=${component2.id}`);
    expect(
      path.join(test.buildDir, 'artifacts', `${component2.id}-${_platform(component2)}.tar.gz`)
    ).to.be.file();
  });
  it('Can open a shell and list component content', function() {
    const test = helpers.createTestEnv(extraConf);
    const component = helpers.createComponent(test);
    blacksmithHandler.exec(
      `--config ${test.configFile} containerized-build --build-dir ${test.buildDir} ` +
      `--json ${component.buildSpecFile} ` +
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`);
    blacksmithHandler.asyncExec(`--config ${test.configFile} shell ${test.buildDir}`);
    // Wait 50 seconds for the container to start
    let running = false;
    let retries = 0;
    let blacksmithContainer = null;
    while (!running && retries < 10) {
      const dt = new Date();
      while ((new Date()) - dt <= 5000); // Wait 5 seconds synchronously
      const runningContainers = spawnSync('docker', ['ps']).stdout.toString();
      const printableDate = dt.toISOString().split('T')[0];
      blacksmithContainer = runningContainers.match(new RegExp(`(blacksmith-shell-${printableDate}-[0-9]*)$`, 'm'));
      if (blacksmithContainer) running = true;
      retries++;
    }
    expect(blacksmithContainer).to.not.be.null;
    const blacksmithContainerName = blacksmithContainer[1];
    const content = spawnSync('docker', ['exec', blacksmithContainerName, 'ls', test.prefix]).stdout.toString();
    spawnSync('docker', ['stop', blacksmithContainerName]);
    spawnSync('docker', ['rm', blacksmithContainerName]);
    expect(content).to.contain('common');
  });
});

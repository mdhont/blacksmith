
'use strict';

const path = require('path');
const chai = require('chai');
const chaiFs = require('chai-fs');
const chaiSubset = require('chai-subset');
const expect = chai.expect;
const helpers = require('blacksmith-test');
const BlacksmithHandler = helpers.Handler;

chai.use(chaiSubset);
chai.use(chaiFs);


describe('#build()', function() {
  this.timeout(120000);
  const blacksmithHandler = new BlacksmithHandler();
  const jobs = 3;
  beforeEach(helpers.cleanTestEnv);
  afterEach(helpers.cleanTestEnv);
  it('Builds a simple package from CLI', function() {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const componentFolder = `${component.id}-${component.version}`;
    const res = blacksmithHandler.exec(
      `--config ${test.configFile} build --build-dir ${test.buildDir} ` +
      `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`);
    expect(
      path.join(test.buildDir, `artifacts/${component.id}-${component.version}-stack-linux-x64.tar.gz`)).to.be.file();
    expect(path.join(test.sandbox, componentFolder, 'LICENSE')).to.be.file();
    expect(res.stdout).to.contain(`prefix=${test.prefix}`);
  });

  it('Builds a simple package using a metadata server', function() {
    const metadataServerEndpoint = 'https://test-metadata-server.net/api/v1';
    const test = helpers.createTestEnv({
      'metadataServer': {
        'activate': true,
        'prioritize': true,
        'endPoint': metadataServerEndpoint
      }
    });
    const component = helpers.createComponent(test);
    helpers.addComponentToMetadataServer(metadataServerEndpoint, component);
    const componentFolder = `${component.id}-${component.version}`;
    const res = blacksmithHandler.javascriptExec(path.join(__dirname, '../index.js'),
    `--config ${test.configFile} --log-level debug build --build-dir ${test.buildDir} ` +
    `${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`);
    expect(
      path.join(test.buildDir, `artifacts/${component.id}-${component.version}-stack-linux-x64.tar.gz`)).to.be.file();
    expect(path.join(test.sandbox, componentFolder, 'LICENSE')).to.be.file();
    expect(res.stdout).to.contain(`Contacting the metadata server to obtain info about ${component.id}`);
  });

  it('Should throw an error if JSON file doesn\'t exists', function() {
    const test = helpers.createTestEnv();
    expect(function() {
      blacksmithHandler.exec(`--config ${test.configFile} build --json /unexistent-path.json`);
    }).to.throw('File /unexistent-path.json not found');
  });

  it('Builds a simple package from JSON with available options', function() {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const componentFolder = `${component.id}-${component.version}`;
    const res = blacksmithHandler.exec(`--log-level trace --log-file ${path.join(test.buildDir, 'test.log')} ` +
    `--config ${test.configFile} ` +
    'build --force-rebuild ' +
    `--json ${component.buildSpecFile} ` +
    '--incremental-tracking ' +
    `--prefix ${test.buildDir} ` +
    `--max-jobs ${jobs}`);
    // Modifies the build ID
    expect(
      path.join(
        test.buildDir,
        'artifacts',
        `${component.buildSpec['build-id']}-linux-x64-${component.buildSpec.flavor}.tar.gz`
      )
    ).to.be.file();
    expect(res.stdout).to.contain('Build completed. Artifacts stored');
    // Modifies the log level
    expect(res.stdout).to.contain('blacksm TRACE ENVIRONMENT VARIABLES');
    // Set the log file
    expect(path.join(test.buildDir, 'test.log')).to.be.file();
    // Modifies the build directory
    expect(res.stdout).to.contain(`Build completed. Artifacts stored under '${test.buildDir}`);
    // Modifies the flavor
    expect(res.stdout).to.contain(`"flavor":"${component.buildSpec.flavor}"`);
    // Uses incremental tracking
    expect(
      path.join(test.buildDir, 'artifacts/components', `${component.id}-${component.version}-linux-x64.tar.gz`)
    ).to.be.file();
    // Modifies the prefix
    expect(path.join(test.buildDir, 'common')).to.be.a.path();
    // Modifies the maximum number of jobs
    expect(res.stdout).to.contain(`["--jobs=${jobs}"]`);
    // Forces rebuilding
    expect(res.stdout).to.contain(`Deleting ${path.join(test.sandbox, componentFolder)}`);
    // Strip components in the minify method
    expect(res.stdout).to.contain('Stripping binary file');
  });
});

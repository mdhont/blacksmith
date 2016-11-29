'use strict';

const path = require('path');
const fs = require('fs');
const chai = require('chai');
const chaiFs = require('chai-fs');
const chaiSubset = require('chai-subset');
const expect = chai.expect;
const helpers = require('blacksmith-test');
const BlacksmithHandler = helpers.Handler;

chai.use(chaiSubset);
chai.use(chaiFs);


describe('#inspect()', function() {
  this.timeout(12000);
  const blacksmithHandler = new BlacksmithHandler();
  let test = null;
  let component1 = null;
  let component2 = null;
  before(function() {
    helpers.cleanTestEnv();
    test = helpers.createTestEnv();
    component1 = helpers.createComponent(test);
    component2 = helpers.createComponent(test, {
      id: 'sample2'
    });
  });
  after(helpers.cleanTestEnv);

  function check(res) {
    expect(res).to.contain(`"id": "${component1.id}"`);
    expect(res).to.contain(`"version": "${component1.version}"`);
    expect(res).to.contain(`"id": "${component2.id}"`);
    expect(res).to.contain(`"version": "${component2.version}"`);
  }

  it('Inspect component properties to stdout', function() {
    const res = blacksmithHandler.javascriptExec(path.join(__dirname, '../index.js'),
      `--config ${test.configFile} inspect --json ${component1.buildSpecFile} ` +
      `${component2.id}:${test.assetsDir}/${component2.id}-${component2.version}.tar.gz`
    );
    check(res.stdout);
  });
  it('Inspect component properties to file', function() {
    blacksmithHandler.javascriptExec(path.join(__dirname, '../index.js'),
      `--config ${test.configFile} inspect ` +
      `--output-file ${path.join(test.buildDir, 'spec.json')} ` +
      `--json ${component1.buildSpecFile} ` +
      `${component2.id}:${test.assetsDir}/${component2.id}-${component2.version}.tar.gz`
    );
    const res = fs.readFileSync(path.join(test.buildDir, 'spec.json')).toString('utf8');
    check(res);
  });
});

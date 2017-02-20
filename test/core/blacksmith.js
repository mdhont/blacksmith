'use strict';

const Blacksmith = require('../../lib/core');
const fs = require('fs');
const helpers = require('../helpers');
const DummyConfigHandler = helpers.DummyConfigHandler;
const chai = require('chai');
const chaiFs = require('chai-fs');
const expect = chai.expect;
chai.use(chaiFs);

describe('Blacksmith', () => {
  before('clean environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  it('creates an instance successfully', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bs = new Blacksmith(config);
    expect(bs.config.conf).to.be.eql(config.conf);
  });
  it('builds a sample package', function() {
    this.timeout(4000);
    const log = {};
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const bs = new Blacksmith(config);
    bs.bm.logger = helpers.getDummyLogger(log);
    const component = helpers.createComponent(test);
    bs.build([`${component.id}:${test.assetsDir}/${component.id}-${component.version}.tar.gz`]);
  });
});

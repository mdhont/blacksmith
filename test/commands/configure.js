'use strict';

const _ = require('lodash');
const fs = require('fs');
const chai = require('chai');
const expect = chai.expect;
const helpers = require('../helpers');
const BlacksmithHandler = helpers.Handler;
const blacksmithHandler = new BlacksmithHandler();

describe('#configure', function() {
  this.timeout(20000);
  it('Throw error when called with wrong arguments', function() {
    expect(() => blacksmithHandler.exec('configure')).to.throw('expects at least 1 argument');
    expect(
      () => blacksmithHandler.exec('configure paths')
    ).to.throw('paths is an Object, you need to specify one of its properties');
    expect(
      () => blacksmithHandler.exec('configure --action add paths.recipes')
    ).to.throw('You need to specify a value');
  });
  function check(configFile, property, value) {
    const config = JSON.parse(fs.readFileSync(configFile, {encoding: 'utf-8'}));
    const actualValue = _.get(config, property);
    return _.isEqual(actualValue, value);
  }
  function get(configFile, property) {
    const config = JSON.parse(fs.readFileSync(configFile, {encoding: 'utf-8'}));
    return _.get(config, property);
  }
  afterEach(helpers.cleanTestEnv);
  it('It set a string property', function() {
    const test = helpers.createTestEnv();
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure compilation.prefix /tmp/test');
    expect(check(test.configFile, 'compilation.prefix', '/tmp/test')).to.be.eql(true);
  });
  it('It set an array property', function() {
    const test = helpers.createTestEnv();
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure --action set paths.recipes /tmp/test');
    expect(check(test.configFile, 'paths.recipes', ['/tmp/test'])).to.be.eql(true);
  });

  it('It adds a value to an array property', function() {
    const test = helpers.createTestEnv();
    const previousValue = get(test.configFile, 'paths.recipes');
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure --action add paths.recipes /tmp/test');
    expect(check(test.configFile, 'paths.recipes', previousValue.concat('/tmp/test'))).to.be.eql(true);
  });
  it('It unset a property', function() {
    const test = helpers.createTestEnv();
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure --action unset compilation.prefix');
    expect(get(test.configFile, 'compilation.prefix')).to.be.eql(null);
  });
});

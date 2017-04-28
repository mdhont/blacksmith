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
      () => blacksmithHandler.exec('configure --action add componentTypeCollections')
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
  it('It sets a string property', function() {
    const test = helpers.createTestEnv();
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure compilation.prefix /tmp/test');
    expect(check(test.configFile, 'compilation.prefix', '/tmp/test')).to.be.eql(true);
  });
  it('It sets an array property', function() {
    const test = helpers.createTestEnv();
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure --action set componentTypeCollections test');
    expect(check(test.configFile, 'componentTypeCollections', ['test'])).to.be.eql(true);
  });
  it('It sets an object', function() {
    const test = helpers.createTestEnv();
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure --action set compilation {"prefix":"/tmp/test"}');
    expect(check(test.configFile, 'compilation', {prefix: '/tmp/test'})).to.be.eql(true);
  });

  it('It adds a value to an array property', function() {
    const test = helpers.createTestEnv();
    const previousValue = get(test.configFile, 'componentTypeCollections');
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure --action add componentTypeCollections test');
    expect(check(test.configFile, 'componentTypeCollections', previousValue.concat('test'))).to.be.eql(true);
  });
  it('It unsets a property', function() {
    const test = helpers.createTestEnv();
    blacksmithHandler.javascriptExec(
      test.configFile,
      'configure --action unset compilation.prefix');
    expect(get(test.configFile, 'compilation.prefix')).to.be.eql(null);
  });
});

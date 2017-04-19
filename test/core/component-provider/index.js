'use strict';

const ComponentProvider = require('../../../lib/core/build-manager/component-provider');
const path = require('path');
const _ = require('lodash');
const helpers = require('../../helpers');
const chai = require('chai');
const expect = chai.expect;
const DummyConfigHandler = helpers.DummyConfigHandler;
const fs = require('fs');

describe('Component Provider', () => {
  before('prepare environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  it('creates an instance successfully', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'), {
      logger: helpers.getDummyLogger()
    });
    const testCP = {
      recipeDirectories: [test.componentDir],
      logger: helpers.getDummyLogger(),
    };
    _.each(testCP, (v, k) => expect(cp[k]).to.be.eql(v));
    expect(cp.logicProvider).to.be.a('Object');
  });

  it('obtains a component', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const component = helpers.createComponent(test);
    const componentObj = cp.getComponent(component.buildSpec.components[0]);
    const desiredComponent = {
      'patches': [], 'patchLevel': 0, 'extraFiles': [], 'pick': [], 'exclude': ['.git', '.__empty_dir'], 'be': null,
      'noDoc': true, 'supportsParallelBuild': true, 'id': component.id, 'version': component.version,
      'source': {
        'tarball': component.source.tarball,
        'sha256': component.source.sha256,
      },
      'metadata': {
        'id': component.id,
        'latest': component.version,
        'licenses': [
          {
            'type': 'BSD3',
            'licenseRelativePath': 'LICENSE',
            'url': 'http://license.org',
            'main': true
          }
        ]
      }
    };
    _.each(desiredComponent, (v, k) => {
      expect(componentObj[k]).to.be.eql(v);
    });
  });
  it('throws an error if no version satisfying the requirements is found', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const component = helpers.createComponent(test);
    const simplifiedComponent = {
      id: component.id, version: component.version
    };
    expect(() => cp.getComponent(simplifiedComponent, {version: '~2'})).to.throw(
      `Current component ${JSON.stringify(simplifiedComponent)} does not satisfies ~2`
    );
  });
  it('obtains a component class based on requirements', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const component = helpers.createComponent(test, {id: 'sample'});
    fs.writeFileSync(path.join(test.componentDir, `${component.id}/index.js`), `
      'use strict';
      class sample1 extends Library {}
      class sample2 extends Library {}
      module.exports = [
        {version: '<2.0', platforms: ['linux'], class: sample1},
        {version: '>=2.0', platforms: ['linux-x64'], class: sample2}
      ];`
    );
    const componentTest = _.assign({}, component.buildSpec.components[0], {version: '1.0.0'});
    expect(
      cp.getComponent(componentTest).constructor.name,
      'Bad class resolution'
    ).to.be.eql('sample1');
    componentTest.version = '2.0.0';
    expect(
      cp.getComponent(componentTest).constructor.name,
      'Bad class resolution'
    ).to.be.eql('sample2');
    expect(() => cp.getComponent(componentTest, {platform: 'linux'}),
      'Bad class resolution'
    ).to.throw(
      'Cannot find any valid specification matching the provided requirements'
    );
  });
  require('./recipe-logic-provider');
});

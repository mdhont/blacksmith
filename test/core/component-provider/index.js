'use strict';

const ComponentProvider = require('../../../lib/core/build-manager/component-provider');
const path = require('path');
const _ = require('lodash');
const helpers = require('../../helpers');
const chai = require('chai');
const expect = chai.expect;
const DummyConfigHandler = helpers.DummyConfigHandler;
const fs = require('fs');
let AnvilClient = null;
try {
  AnvilClient = require('anvil-client'); // eslint-disable-line import/no-unresolved
} catch (e) { /* Anvil client is not available */ }

describe('Component Provider', () => {
  const metadataServerTestingEndpoint = 'https://test-metadata-server.net/api/v1';
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
      metadataServer: null
    };
    _.each(testCP, (v, k) => expect(cp[k]).to.be.eql(v));
    expect(cp.metadataProvider).to.be.a('Object');
    expect(cp.logicProvider).to.be.a('Object');
  });

  describe('using a metadata server', function() {
    before(function() {
      if (!AnvilClient) {
        this.skip();
      }
    });
    it('instantiates a client for the metadata server', function() {
      const test = helpers.createTestEnv();
      const component = helpers.createComponent(test, {
        id: 'sample', version: '1.0.0', licenseType: 'BSD3', licenseRelativePath: 'LICENSE'
      });
      helpers.addComponentToMetadataServer(metadataServerTestingEndpoint, component);
      const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
      const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'), {
        metadataServer: {
          activate: true,
          prioritize: true,
          endPoint: metadataServerTestingEndpoint
        }
      });
      expect(cp.metadataServer.client).to.be.a('Object');
    });
    it('deactivates the metadata server', () => {
      const test = helpers.createTestEnv();
      const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
      const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'), {
        metadataServer: {
          activate: false,
          prioritize: true,
          endPoint: metadataServerTestingEndpoint
        }
      });
      expect(cp.metadataServer).to.be.eql(null);
    });
  });

  it('obtains a component', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const component = helpers.createComponent(test);
    const componentObj = cp.getComponent(component.id);
    const desiredComponent = {
      'patches': [], 'patchLevel': 0, 'extraFiles': [], 'pick': [], 'exclude': ['.git', '.__empty_dir'], 'be': null,
      'source': {}, 'noDoc': true, 'supportsParallelBuild': true, 'id': component.id,
      'metadata': {
        'id': component.id,
        'version': component.version,
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
    expect(() => cp.getComponent(component.id, {version: '~2'})).to.throw('Not found any version satisfying ~2');
  });
  it('throws an error if no component is found', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    expect(() => cp.getComponent('no-exists')).to.throw(
      `Unable to find a recipe for no-exists in ${test.componentDir}`
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
    expect(cp.getComponent({id: component.id}).constructor.name, 'Bad class resolution').to.be.eql('sample1');
    expect(cp.getComponent({
      id: component.id, version: '1.0.0'
    }).constructor.name, 'Bad class resolution').to.be.eql('sample1');
    expect(cp.getComponent({
      id: component.id, version: '2.0.0'
    }).constructor.name, 'Bad class resolution').to.be.eql('sample2');
    expect(cp.getComponent(component.id, {
      platform: 'linux-x64'
    }).constructor.name, 'Bad class resolution').to.be.eql('sample2');
  });
  require('./recipe-logic-provider');
  require('./recipe-metadata-provider');
});

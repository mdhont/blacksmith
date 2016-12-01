'use strict';

const ComponentProvider = require('../lib/build-manager/component-provider');
const path = require('path');
const _ = require('lodash');
const helpers = require('blacksmith-test');
const chai = require('chai');
const expect = chai.expect;
const DummyConfigHandler = helpers.DummyConfigHandler;
const fs = require('fs');

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
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const testCP = {
      _searchPath: [test.componentDir],
      componentTypeCollections: config.get('componentTypeCollections')
    };
    _.each(testCP, (v, k) => expect(cp[k]).to.be.eql(v));
  });
  it('creates an instance with different logger and extra component types', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'), {
      logger: helpers.getDummyLogger()
    });
    const testCP = {
      _searchPath: [test.componentDir],
      componentTypeCollections: config.get('componentTypeCollections'),
      logger: helpers.getDummyLogger()
    };
    _.each(testCP, (v, k) => expect(cp[k]).to.be.eql(v));
  });
  it('obtains a recipe using a file', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const component = helpers.createComponent(test);
    const recipe = cp.getRecipe(component.id);
    const desiredRecipe = {
      'metadata': {
        'id': component.id,
        'version': component.version,
        'licenses': [
          {
            'type': 'BSD3',
            'licenseRelativePath': 'LICENSE',
            'main': true
          }
        ],
      },
      '_componentTypeCollections': config.get('componentTypeCollections')
    };
    _.each(desiredRecipe, (v, k) => expect(recipe[k]).to.be.eql(v));
    expect(() => cp.getRecipe(component.id, {version: '~2'})).to.throw('Not found any version satisfying ~2');
    expect(() => cp.getRecipe('no-exists')).to.throw('Not found any source of metadata for no-exists');
  });

  xit('obtains a recipe using a metadata server', () => {
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
    const recipe = cp.getRecipe(component.id);
    const desiredRecipe = {
      'metadata': {
        'id': component.id,
        'version': component.version,
        'licenses': [{'type': 'BSD3', 'licenseRelativePath': 'LICENSE', 'main': true}],
      },
      '_componentTypeCollections': config.get('componentTypeCollections')
    };
    _.each(desiredRecipe, (v, k) => expect(recipe[k]).to.be.eql(v));
    helpers.addNotFoundEntries(
      metadataServerTestingEndpoint,
      ['/components/sample/~2', '/components/no-exists/latest']
    );
    // Test missing version
    expect(() => cp.getRecipe(component.id, {version: '~2'})).to.throw('404');
    // Test missing component
    expect(() => cp.getRecipe('no-exists')).to.throw('404');
  });

  xit('prioritizes the source of metadata', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'), {
      metadataServer: {
        activate: true,
        prioritize: false,
        endPoint: metadataServerTestingEndpoint
      }
    });
    const component = helpers.createComponent(test, {
      id: 'sample', version: '2.0.0', licenseType: 'local', licenseRelativePath: 'local'
    });
    const recipe = cp.getRecipe(component.id);
    const desiredRecipe = {
      'metadata': {
        'id': component.id,
        'version': component.version,
        'licenses': [{'type': 'local', 'licenseRelativePath': 'local', 'main': true}],
      },
      '_componentTypeCollections': config.get('componentTypeCollections')
    };
    _.each(desiredRecipe, (v, k) => expect(recipe[k]).to.be.eql(v));
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
    const component = helpers.createComponent(test, {
      id: 'sample', version: '2.0.0', licenseType: 'local', licenseRelativePath: 'local'
    });
    const recipe = cp.getRecipe(component.id);
    const desiredRecipe = {
      'metadata': {
        'id': component.id,
        'version': component.version,
        'licenses': [{'type': 'local', 'licenseRelativePath': 'local', 'main': true}],
      },
      '_componentTypeCollections': config.get('componentTypeCollections')
    };
    _.each(desiredRecipe, (v, k) => expect(recipe[k]).to.be.eql(v));
  });

  it('finds a recipe', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const component = helpers.createComponent(test);
    const recipePath = cp.findRecipe(component.id);
    expect(recipePath).to.be.eql(path.join(test.componentDir, component.id));
    expect(cp.findRecipe('no-exists')).to.be.eql(null);
  });
  it('parses a component reference', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    let parsedComponent = cp.parseComponentReference('test');
    expect(parsedComponent.id).to.be.eql('test');
    parsedComponent = cp.parseComponentReference(`test@1.2.3`);
    expect(parsedComponent.id).to.be.eql('test');
    expect(parsedComponent.version).to.be.eql('1.2.3');
    parsedComponent = cp.parseComponentReference(`test:/tmp/test.tar.gz`);
    expect(parsedComponent.id).to.be.eql('test');
    expect(parsedComponent.sourceTarball).to.be.eql('/tmp/test.tar.gz');
    parsedComponent = cp.parseComponentReference(`test@1.2.3:/tmp/test.tar.gz`);
    expect(parsedComponent.id).to.be.eql('test');
    expect(parsedComponent.version).to.be.eql('1.2.3');
    expect(parsedComponent.sourceTarball).to.be.eql('/tmp/test.tar.gz');
  });

  it('obtains a component', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const component = helpers.createComponent(test);
    const componentObj = cp.getComponent(component.id);
    const desiredComponent = {
      'patches': [], 'patchLevel': 0, 'extraFiles': [], 'pick': [], 'exclude': ['.git', '.__empty_dir'], 'be': null,
      'sourceTarball': null, 'noDoc': true, 'supportsParallelBuild': true, 'id': component.id,
      'metadata': {
        'id': component.id,
        'version': component.version,
        'licenses': [
          {
            'type': 'BSD3',
            'licenseRelativePath': 'LICENSE',
            'main': true
          }
        ]
      }
    };
    _.each(desiredComponent, (v, k) => {
      expect(componentObj[k]).to.be.eql(v);
    });
    expect(() => cp.getComponent(component.id, {version: '~2'})).to.throw('Not found any version satisfying ~2');
    expect(() => cp.getRecipe('no-exists')).to.throw('Not found any source of metadata for no-exists');
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
});

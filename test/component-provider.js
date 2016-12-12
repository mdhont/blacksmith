'use strict';

const ComponentProvider = require('../lib/build-manager/component-provider');
const Recipe = require('../lib/build-manager/component-provider/recipe');
const path = require('path');
const _ = require('lodash');
const helpers = require('blacksmith-test');
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
    const cp = new ComponentProvider(test.componentDir, config.get('componentTypeCollections'));
    const testCP = {
      recipeDirectories: [test.componentDir],
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
      recipeDirectories: [test.componentDir],
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

  if (AnvilClient) {
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
  }

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

  describe('Recipe', function() {
    before('prepare environment', () => {
      helpers.cleanTestEnv();
    });
    afterEach('clean environment', () => {
      helpers.cleanTestEnv();
    });
    it('instantiates a Recipe without errors', function() {
      const test = helpers.createTestEnv();
      const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
      const component = helpers.createComponent(test);
      const recipe = new Recipe(component.id, [test.componentDir], config.get('componentTypeCollections'));
      const expectedRecipe = {
        _recipeDirectories: [test.componentDir],
        metadata: {
          id: component.id,
          licenses: [{main: true, type: component.licenseType, licenseRelativePath: component.licenseRelativePath}],
          version: component.version
        },
        _componentTypeCollections: config.get('componentTypeCollections'),
      };
      _.each(expectedRecipe, (v, k) => {
        expect(recipe[k]).to.be.eql(v, `Unmatched ${k}`);
      });
      expect(recipe.componentClass).to.be.a('Function');
      const recipeText = fs.readFileSync(path.join(test.componentDir, `${component.id}/index.js`), {encoding: 'utf8'});
      const classText = recipeText.match(/(class.*)/)[1];
      expect(recipe.componentClass.toString()).to.be.eql(classText);
    });
    it('finds a Recipe inside a \'compilation\' folder', function() {
      const test = helpers.createTestEnv();
      const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
      const component = helpers.createComponent(test);
      const recipe = new Recipe(component.id, [test.componentDir], config.get('componentTypeCollections'));
      fs.mkdirSync(path.join(test.componentDir, `${component.id}/compilation`));
      fs.renameSync(
        path.join(test.componentDir, `${component.id}/index.js`),
        path.join(test.componentDir, `${component.id}/compilation/index.js`)
      );
      expect(recipe.componentClass).to.be.a('Function');
    });
    it('validates a Recipe metadata', function() {
      expect(() => {
        Recipe.validateMetadata({id: 'test', version: 'test', licenses: 'test'});
      }).to.not.throw('Error validating');
    });
    it('throws an error with wrong metadata', function() {
      const fields = ['id', 'version', 'licenses'];
      _.each(fields, field => {
        const metadata = {id: 'test', version: 'test', licenses: 'test'};
        metadata[field] = '';
        expect(() => {
          Recipe.validateMetadata(metadata);
        }).to.throw(`Error validating the component metadata: The field ${field} is empty`);
      });
    });
    it('loads a different Recipe without errors', function() {
      const test = helpers.createTestEnv();
      const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
      const component = helpers.createComponent(test);
      const recipe = new Recipe(component.id, [test.componentDir], config.get('componentTypeCollections'));
      const component2 = helpers.createComponent(test, {id: 'component2'});
      const recipe2 = recipe.loadBuildInstructions(component2.id, [test.componentDir]);
      expect(recipe2).to.be.a('Function');
    });
    it('exposes global functionalities for build instructions', function() {
      const test = helpers.createTestEnv();
      const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
      const component = helpers.createComponent(test);
      const recipe = new Recipe(component.id, [test.componentDir], config.get('componentTypeCollections'));
      const component2 = helpers.createComponent(test, {id: 'component2'});
      fs.writeFileSync(path.join(test.componentDir, `${component2.id}/index.js`), `
      'use strict';
      const PreviousComponent = $loadBuildInstructions('${component.id}')
      class Test extends PreviousComponent{
        initialize() {
          const modulesToLoad = [_, path, $bu, $os, $file, $util];
          modulesToLoad.forEach(mod => {
            if (typeof mod === 'undefined') throw new Error('Failed to load module');
          });
        }
      }
      module.exports = Test;`);
      const Test = recipe.loadBuildInstructions(component2.id, [test.componentDir]);
      const componentInstance = new Test();
      expect(componentInstance.initialize).to.not.throw();
    });
    if (AnvilClient) {
      it('obtains a recipe using a metadata server', () => {
        const test = helpers.createTestEnv();
        const component = helpers.createComponent(test, {
          id: 'sample', version: '1.0.0', licenseType: 'BSD3', licenseRelativePath: 'LICENSE'
        });
        helpers.addComponentToMetadataServer(metadataServerTestingEndpoint, component);
        const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
        const recipe = new Recipe(component.id, [test.componentDir], config.get('componentTypeCollections'), {
          metadataServer: {
            client: new AnvilClient(metadataServerTestingEndpoint),
            prioritize: true
          }
        });
        const desiredMetadata = {
          'id': component.id,
          'version': component.version,
          'licenses': [{'type': 'BSD3', 'licenseRelativePath': 'LICENSE', 'main': true}],
        };
        expect(recipe.metadata).to.be.eql(desiredMetadata);
      });
      it('throws a not found error if the component metadata doesn\'t exists in the metadata server', function() {
        const test = helpers.createTestEnv();
        const component = helpers.createComponent(test, {
          id: 'sample', version: '1.0.0', licenseType: 'BSD3', licenseRelativePath: 'LICENSE'
        });
        const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
        helpers.addNotFoundEntries(
          metadataServerTestingEndpoint,
          ['/components/sample/~2.0.0', '/components/no-exists/latest']
        );
        // Test missing version
        expect(() => {
          new Recipe(  // eslint-disable-line no-new
            component.id,
            [test.componentDir],
            config.get('componentTypeCollections'),
            {
              metadataServer: {client: new AnvilClient(metadataServerTestingEndpoint), prioritize: true},
              requirements: {version: '~2.0.0'}
            }
          );
        }).to.throw('404');
        // Test missing component
        expect(() => {
          new Recipe(  // eslint-disable-line no-new
            'no-exists',
            [test.componentDir],
            config.get('componentTypeCollections'),
            {
              metadataServer: {client: new AnvilClient(metadataServerTestingEndpoint), prioritize: true}
            }
          );
        }).to.throw('404');
      });
      it('lowers the priority of the metadata server', () => {
        const test = helpers.createTestEnv();
        const desiredVersion = '2.0.0';
        const component = helpers.createComponent(test, {
          id: 'sample', version: desiredVersion, licenseType: 'BSD3', licenseRelativePath: 'LICENSE'
        });
        helpers.addComponentToMetadataServer(
          metadataServerTestingEndpoint,
          _.assign({}, component, {version: '1.0.0'})
        );
        const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
        const recipe = new Recipe(component.id, [test.componentDir], config.get('componentTypeCollections'), {
          metadataServer: {
            client: new AnvilClient(metadataServerTestingEndpoint),
            prioritize: false
          }
        });
        expect(recipe.metadata.version).to.be.eql(desiredVersion);
      });
    }
  });
});

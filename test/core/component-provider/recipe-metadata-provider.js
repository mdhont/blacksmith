'use strict';
const RecipeMetadataProvider = require('../../../lib/core/build-manager/component-provider/recipe/metadata-provider');
const path = require('path');
const _ = require('lodash');
const helpers = require('../../helpers');
const chai = require('chai');
const expect = chai.expect;
let AnvilClient = null;
try {
  AnvilClient = require('anvil-client'); // eslint-disable-line import/no-unresolved
} catch (e) { /* Anvil client is not available */ }

describe('RecipeMetadataProvider', function() {
  const metadataServerTestingEndpoint = 'https://test-metadata-server.net/api/v1';
  before('prepare environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  it('gets a recipe metadata without errors', function() {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const recipeMetadataProvider = new RecipeMetadataProvider([test.componentDir]);
    const metadata = recipeMetadataProvider.getMetadata(component.id, {
      recipeDir: path.join(test.componentDir, component.id)
    });
    const expectedMetadata = {
      id: component.id,
      licenses: [{
        main: true,
        type: component.licenseType,
        url: component.licenseUrl,
        licenseRelativePath: component.licenseRelativePath
      }],
      version: component.version
    };
    expect(metadata).to.be.eql(expectedMetadata);
  });
  it('validates a Recipe metadata', function() {
    expect(() => {
      RecipeMetadataProvider.validateMetadata({id: 'test', version: 'test', licenses: 'test'});
    }).to.not.throw('Error validating');
  });
  it('throws an error with wrong metadata', function() {
    const fields = ['id', 'version', 'licenses'];
    _.each(fields, field => {
      const metadata = {id: 'test', version: 'test', licenses: 'test'};
      metadata[field] = '';
      expect(() => {
        RecipeMetadataProvider.validateMetadata(metadata);
      }).to.throw(`Error validating the component metadata: The field ${field} is empty`);
    });
  });
  describe('using a metadata server', function() {
    before(function() {
      if (!AnvilClient) {
        this.skip();
      }
    });
    it('obtains a recipe using a metadata server', function() {
      const component = {
        id: 'sample',
        version: '1.0.0',
        licenseType: 'BSD3',
        licenseRelativePath: 'LICENSE',
        licenseUrl: 'http://license.org'
      };
      helpers.addComponentToMetadataServer(metadataServerTestingEndpoint, component);

      const recipeMetadataProvider = new RecipeMetadataProvider({
        client: new AnvilClient(metadataServerTestingEndpoint),
        prioritize: true
      });
      const metadata = recipeMetadataProvider.getMetadata(component.id);

      const desiredMetadata = {
        'id': component.id,
        'version': component.version,
        'licenses': [{
          'type': 'BSD3', 'licenseUrl': component.licenseUrl, 'licenseRelativePath': 'LICENSE', 'main': true
        }],
      };
      expect(metadata).to.be.eql(desiredMetadata);
    });
    it('throws a not found error if the component doesn\'t exists in the metadata server', function() {
      helpers.addNotFoundEntries(metadataServerTestingEndpoint, ['/components/no-exists/latest']);

      const recipeMetadataProvider = new RecipeMetadataProvider({
        client: new AnvilClient(metadataServerTestingEndpoint),
        prioritize: true
      });

      expect(() => {
        recipeMetadataProvider.getMetadata('no-exists');
      }).to.throw('Not found any metadata for no-exists');
    });
    it('throws an error if the component version required doesn\'t exists in the metadata server', function() {
      const component = {
        id: 'sample', version: '1.0.0', licenseType: 'BSD3', licenseRelativePath: 'LICENSE'
      };
      helpers.addComponentToMetadataServer(metadataServerTestingEndpoint, component);
      helpers.addNotFoundEntries(metadataServerTestingEndpoint, ['/components/sample/~2.0.0']);
      const recipeMetadataProvider = new RecipeMetadataProvider({
        client: new AnvilClient(metadataServerTestingEndpoint),
        prioritize: true
      });

      expect(() => {
        recipeMetadataProvider.getMetadata(component.id, {requirements: {version: '~2.0.0'}});
      }).to.throw('Not found any metadata for sample satisfying: {"version":"~2.0.0"}');
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

      const recipeMetadataProvider = new RecipeMetadataProvider({
        client: new AnvilClient(metadataServerTestingEndpoint),
        prioritize: false
      });
      const metadata = recipeMetadataProvider.getMetadata(component.id, {
        recipeDir: path.join(test.componentDir, component.id)
      });

      expect(metadata.version).to.be.eql(desiredVersion);
    });
  });
});

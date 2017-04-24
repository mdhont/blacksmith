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
  it('obtains a component', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(config.get('componentTypeCollections'));
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
  it('returns a component with non semver version', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(config.get('componentTypeCollections'));
    const component = helpers.createComponent(test, {version: '1.0.0rc1'});
    expect(cp.getComponent(component.buildSpec.components[0], {version: '~1'}).version).to.be.eql('1.0.0rc1');
  });
  it('throws an error if no version satisfying the requirements is found', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider(config.get('componentTypeCollections'));
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
    const cp = new ComponentProvider(config.get('componentTypeCollections'));
    const component = helpers.createComponent(test, {id: 'sample'});
    fs.writeFileSync(path.join(test.componentDir, `${component.id}/index.js`), `
      'use strict';
      class sample1 extends Library {}
      class sample2 extends Library {}
      class subSample extends sample2 {}
      module.exports = [
        {id: '${component.id}', version: '<2.0', platforms: ['linux'], class: sample1},
        {id: '${component.id}', version: '>=2.0', platforms: ['linux-x64'], class: sample2},
        {id: 'sub-sample', version: '>=2.0', platforms: ['linux-x64'], class: subSample},
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
    componentTest.id = 'sub-sample';
    expect(
      cp.getComponent(componentTest).constructor.name,
      'Bad class resolution'
    ).to.be.eql('subSample');
    expect(() => cp.getComponent(componentTest, {platform: 'linux'}),
      'Bad class resolution'
    ).to.throw(
      'Cannot find any valid specification matching the provided requirements'
    );
  });
  it('obtains a component that has a custom component type', () => {
    const test = helpers.createTestEnv();
    const componentType = `class CustomComponent {}
      module.exports = CustomComponent`;
    const componentTypeFile = path.join(test.buildDir, 'component.js');
    fs.writeFileSync(componentTypeFile, componentType);
    // Delete require cache for the new file in case it has been already used
    delete require.cache[require.resolve(componentTypeFile)];
    const cp = new ComponentProvider(componentTypeFile);
    const component = helpers.createComponent(test);
    fs.writeFileSync(component.recipeLogicPath, `class MyComponent extends CustomComponent {}
      module.exports = MyComponent`);
    const componentObj = cp.getComponent(component.buildSpec.components[0]);
    expect(componentObj.constructor.name).to.be.eql('MyComponent');
  });
  it('obtains a component that has a custom component type exposed as an object', () => {
    const test = helpers.createTestEnv();
    const componentType = `class CustomComponent1 {}
    class CustomComponent2 {}
      module.exports = {CustomComponent1: CustomComponent1, CustomComponent2: CustomComponent2}`;
    const componentTypeFile = path.join(test.buildDir, 'component.js');
    fs.writeFileSync(componentTypeFile, componentType);
    // Delete require cache for the new file in case it has been already used
    delete require.cache[require.resolve(componentTypeFile)];
    const cp = new ComponentProvider(componentTypeFile);
    const component = helpers.createComponent(test);
    fs.writeFileSync(component.recipeLogicPath, `class MyComponent extends CustomComponent1 {}
      module.exports = MyComponent`);
    const componentObj = cp.getComponent(component.buildSpec.components[0]);
    expect(componentObj.constructor.name).to.be.eql('MyComponent');
  });
  it('obtains a component that has a custom component type exposed as an alias', () => {
    const test = helpers.createTestEnv();
    const componentType = `class CustomComponent {}
      module.exports = {CustomComponent: CustomComponent, CustomComponent1: CustomComponent}`;
    const componentTypeFile = path.join(test.buildDir, 'component.js');
    fs.writeFileSync(componentTypeFile, componentType);
    // Delete require cache for the new file in case it has been already used
    delete require.cache[require.resolve(componentTypeFile)];
    const cp = new ComponentProvider(componentTypeFile);
    const component = helpers.createComponent(test);
    fs.writeFileSync(component.recipeLogicPath, `class MyComponent extends CustomComponent1 {}
      module.exports = MyComponent`);
    const componentObj = cp.getComponent(component.buildSpec.components[0]);
    expect(componentObj.constructor.name).to.be.eql('MyComponent');
  });
});

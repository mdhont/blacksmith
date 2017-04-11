'use strict';

const ComponentList = require('../../lib/core/build-manager/component-list');
const ComponentProvider = require('../../lib/core/build-manager/component-provider');
const BuildEnvironment = require('../../lib/core/build-manager/build-environment');
const path = require('path');
const _ = require('lodash');
const fs = require('fs');
const helpers = require('../helpers');
const DummyConfigHandler = helpers.DummyConfigHandler;
const chai = require('chai');
const chaiFs = require('chai-fs');
const expect = chai.expect;
chai.use(chaiFs);

describe('Component List', () => {
  before('prepare environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  function _getComponentProperties(component, be, componentList) {
    return {
      patches: [],
      patchLevel: 0,
      extraFiles: [],
      pick: [],
      exclude: ['.git', '.__empty_dir'],
      be: be,
      metadata: {
        'id': component.id,
        'latest': component.version,
        'licenses': [
          {
            'licenseRelativePath': 'LICENSE',
            'url': 'http://license.org',
            'main': true,
            'type': 'BSD3'
          }
        ]
      },
      source: {
        tarball: component.source.tarball,
        sha256: component.source.sha256,
      },
      noDoc: true,
      supportsParallelBuild: true,
      id: component.id,
      version: component.version,
      componentList: componentList,
      maxParallelJobs: Infinity
    };
  }
  it('creates an instance successfully', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const component = helpers.createComponent(test);
    const componentList = new ComponentList(component.buildSpec, cp, be, config);
    _.each(_getComponentProperties(component, be, componentList), (v, k) => {
      expect(componentList._components[0][k]).to.be.eql(v, `Failed to validate ${k}`);
    });
  });

  function _createUnvalidComponent(test, component) {
    const logicFile = path.join(test.componentDir, component.id, 'index.js');
    const logic = `'use strict';
    class ${component.id} extends Component {
      validate(){
        throw new Error('test')
      }
    }
    module.exports = ${component.id};`;
    fs.writeFileSync(logicFile, logic);
  }

  function _createComponentWithInitialization(test, component) {
    const logicFile = path.join(test.componentDir, component.id, 'index.js');
    const logic = `'use strict';
    class ${component.id} extends Component {
      initialize(){
        this.testProperty = true;
      }
    }
    module.exports = ${component.id};`;
    fs.writeFileSync(logicFile, logic);
  }

  it('changes abortOnError', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const component = helpers.createComponent(test);
    _createUnvalidComponent(test, component);
    expect(() => new ComponentList(component.buildSpec, cp, be, config, helpers.getDummyLogger(), {
      abortOnError: false, logger: helpers.getDummyLogger()
    })).to.not.throw('test');
    expect(() => new ComponentList(component.buildSpec, cp, be, config, helpers.getDummyLogger(), {
      abortOnError: true
    })).to.throw('test');
  });
  it('skips validation', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    _createUnvalidComponent(test, component);
    expect(() => new ComponentList(component.buildSpec, cp, be, config, helpers.getDummyLogger(), {
      validate: false
    })).to.not.throw('test');
    expect(() => new ComponentList(component.buildSpec, cp, be, config, helpers.getDummyLogger(), {
      validate: true
    })).to.throw('test');
  });
  it('disables initialization', () => {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const component = helpers.createComponent(test);
    _createComponentWithInitialization(test, component);
    const componentList = new ComponentList(component.buildSpec, cp, be, config, helpers.getDummyLogger(), {
      initialize: true
    });
    expect(componentList._components[0].testProperty).to.be.eql(true);
  });
  it('adds a component', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const componentList = new ComponentList([], cp, be, config);
    componentList.add(component.buildSpec.components[0], be, cp, config);
    _.each(_getComponentProperties(component, be, componentList), (v, k) => {
      expect(componentList._components[0][k]).to.be.eql(v);
    });
  });
  it('adds a several time with different information', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const componentList = new ComponentList([], cp, be, config);
    componentList.add({id: component.id, version: '123.123.123', patches: ['/test.patch']}, be, cp, config);
    componentList.add(component.buildSpec.components[0], be, cp, config);
    const desiredResult = _getComponentProperties(component, be, componentList);
    desiredResult.patches = ['/test.patch'];
    _.each(desiredResult, (v, k) => {
      expect(componentList._components[0][k]).to.be.eql(v);
    });
  });
  it('gets a component', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const componentList = new ComponentList(component.buildSpec, cp, be, config);
    const returnedComponent = componentList.get(component.id);
    _.each(_getComponentProperties(component, be, componentList), (v, k) => {
      expect(returnedComponent[k]).to.be.eql(v);
    });
  });
  it('gets all component', () => {
    const test = helpers.createTestEnv();
    const component1 = helpers.createComponent(test);
    const component2 = helpers.createComponent(test, {id: 'sample2'});
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    component1.buildSpec.components = component1.buildSpec.components.concat(component2.buildSpec.components);
    const componentList = new ComponentList(component1.buildSpec, cp, be, config);
    const componentObjs = componentList.getObjs();
    _.each([component1, component2], component => {
      const componentFromList = _.find(componentObjs, {id: component.id});
      _.each(_getComponentProperties(component, be, componentList), (v, k) => {
        expect(componentFromList[k]).to.be.eql(v);
      });
    });
  });
  it('populates flags from dependencies', () => {
    const test = helpers.createTestEnv();
    const component = helpers.createComponent(test);
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    const componentList = new ComponentList(component.buildSpec, cp, be, config);
    const dep = {};
    dep[component.id] = ['--test-prefix={{prefix}}'];
    const flags = componentList.populateFlagsFromDependencies(dep);
    expect(flags).to.be.eql([`--test-prefix=${test.prefix}/common`]);
  });
  it('get the correct index', () => {
    const test = helpers.createTestEnv();
    const component1 = helpers.createComponent(test);
    const component2 = helpers.createComponent(test, {id: 'sample2'});
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    component1.buildSpec.components = component1.buildSpec.components.concat(component2.buildSpec.components);
    const componentList = new ComponentList(component1.buildSpec, cp, be, config);
    expect(componentList.getIndex(component1.id)).to.be.eql(0);
    expect(componentList.getIndex(component2.id)).to.be.eql(1);
  });
  it('get the printable list of components', () => {
    const test = helpers.createTestEnv();
    const component1 = helpers.createComponent(test);
    const component2 = helpers.createComponent(test, {id: 'sample2'});
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const cp = new ComponentProvider([test.componentDir], config.get('componentTypeCollections'));
    const be = new BuildEnvironment({
      outputDir: test.buildDir,
      prefixDir: test.prefix,
      sandboxDir: test.sandbox
    });
    component1.buildSpec.components = component1.buildSpec.components.concat(component2.buildSpec.components);
    const componentList = new ComponentList(component1.buildSpec, cp, be, config);
    expect(componentList.getPrintableList()).
    to.be.eql(`${component1.id}@${component1.version}, ${component2.id}@${component2.version}`);
  });
});

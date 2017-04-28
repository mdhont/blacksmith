'use strict';

const RecipeLogicProvider = require('../../../lib/core/build-manager/component-provider/recipe/logic-provider');
const path = require('path');
const helpers = require('../../helpers');
const chai = require('chai');
const expect = chai.expect;
const DummyConfigHandler = helpers.DummyConfigHandler;
const fs = require('fs');

describe('RecipeLogicProvider', function() {
  before('prepare environment', () => {
    helpers.cleanTestEnv();
  });
  afterEach('clean environment', () => {
    helpers.cleanTestEnv();
  });
  it('obtains a recipe class without errors', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider(config.get('componentTypeCollections'));
    const buildInstructions = recipeLogicProvider.getRecipeClass(component.recipeLogicPath);

    expect(buildInstructions).to.be.a('Function');
    const recipeText = fs.readFileSync(path.join(test.componentDir, `${component.id}/index.js`), {encoding: 'utf8'});
    const classText = recipeText.match(/(class.*)/)[1];
    expect(buildInstructions.toString()).to.be.eql(classText);
  });
  it('obtains a recipe class without errors specifying the directory', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider(config.get('componentTypeCollections'));
    const buildInstructions = recipeLogicProvider.getRecipeClass(component.recipeLogicPath);

    const recipeText = fs.readFileSync(path.join(test.componentDir, `${component.id}/index.js`), {encoding: 'utf8'});
    const classText = recipeText.match(/(class.*)/)[1];
    expect(buildInstructions.toString()).to.be.eql(classText);
  });
  it('obtains a recipe class without errors satisfying some requirements', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider(config.get('componentTypeCollections'));
    fs.writeFileSync(path.join(test.componentDir, `${component.id}/index.js`), `
    'use strict';
    class Test1 extends Component{}
    class Test2 extends Component{}
    module.exports = [
      {class: Test1, version: '~1'},
      {class: Test2, version: '~2'}
    ];`);
    const buildInstructions1 = recipeLogicProvider.getRecipeClass(
      component.recipeLogicPath,
      {version: '1.1.0'}
    );
    const buildInstructions2 = recipeLogicProvider.getRecipeClass(
      component.recipeLogicPath,
      {version: '2.2.0'}
    );

    expect(buildInstructions1.toString()).to.contain('class Test1');
    expect(buildInstructions2.toString()).to.contain('class Test2');
  });
  it('obtains a recipe class without errors using a Factory', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider(config.get('componentTypeCollections'));
    fs.writeFileSync(path.join(test.componentDir, `${component.id}/index.js`), `
    'use strict';
    class Test1 extends Component{}
    class Test2 extends Component{}
    function factory(requirements) {
      if(requirements.test === '1') {
        return Test1;
      } else {
        return Test2;
      }
    }
    module.exports = factory;`);
    const buildInstructions1 = recipeLogicProvider.getRecipeClass(
      component.recipeLogicPath,
      {test: '1'}
    );
    const buildInstructions2 = recipeLogicProvider.getRecipeClass(
      component.recipeLogicPath,
      {test: '2'}
    );

    expect(buildInstructions1.toString()).to.contain('class Test1');
    expect(buildInstructions2.toString()).to.contain('class Test2');
  });

  it('loads the build instructions of a recipe', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider(config.get('componentTypeCollections'));
    const buildInstructions = recipeLogicProvider.loadBuildInstructions(component.recipeLogicPath);

    expect(buildInstructions).to.be.a('Function');
  });
});

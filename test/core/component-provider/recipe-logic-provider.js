'use strict';

const RecipeLogicProvider = require('../../../lib/core/build-manager/component-provider/recipe/logic-provider');
const path = require('path');
const helpers = require('blacksmith-test');
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

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
    const buildInstructions = recipeLogicProvider.getRecipeClass(component.id);

    expect(buildInstructions).to.be.a('Function');
    const recipeText = fs.readFileSync(path.join(test.componentDir, `${component.id}/index.js`), {encoding: 'utf8'});
    const classText = recipeText.match(/(class.*)/)[1];
    expect(buildInstructions.toString()).to.be.eql(classText);
  });
  it('obtains a recipe class without errors specifying the directory', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
    const recipeDir = recipeLogicProvider.findRecipeFolder(component.id);
    const buildInstructions = recipeLogicProvider.getRecipeClass(component.id, recipeDir);

    const recipeText = fs.readFileSync(path.join(test.componentDir, `${component.id}/index.js`), {encoding: 'utf8'});
    const classText = recipeText.match(/(class.*)/)[1];
    expect(buildInstructions.toString()).to.be.eql(classText);
  });
  it('obtains a recipe class without errors satisfying some requirements', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
    const recipeDir = recipeLogicProvider.findRecipeFolder(component.id);
    fs.writeFileSync(path.join(test.componentDir, `${component.id}/index.js`), `
    'use strict';
    class Test1 extends Component{}
    class Test2 extends Component{}
    module.exports = [
      {class: Test1, version: '~1'},
      {class: Test2, version: '~2'}
    ];`);
    const buildInstructions1 = recipeLogicProvider.getRecipeClass(component.id, recipeDir, {version: '1.1.0'});
    const buildInstructions2 = recipeLogicProvider.getRecipeClass(component.id, recipeDir, {version: '2.2.0'});

    expect(buildInstructions1.toString()).to.contain('class Test1');
    expect(buildInstructions2.toString()).to.contain('class Test2');
  });
  it('obtains a recipe class without errors using a Factory', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
    const recipeDir = recipeLogicProvider.findRecipeFolder(component.id);
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
    const buildInstructions1 = recipeLogicProvider.getRecipeClass(component.id, recipeDir, {test: '1'});
    const buildInstructions2 = recipeLogicProvider.getRecipeClass(component.id, recipeDir, {test: '2'});

    expect(buildInstructions1.toString()).to.contain('class Test1');
    expect(buildInstructions2.toString()).to.contain('class Test2');
  });

  it('finds a Recipe inside a \'compilation\' folder', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);
    const recipeText = fs.readFileSync(path.join(test.componentDir, `${component.id}/index.js`), {encoding: 'utf8'});
    fs.mkdirSync(path.join(test.componentDir, `${component.id}/compilation`));
    fs.renameSync(
      path.join(test.componentDir, `${component.id}/index.js`),
      path.join(test.componentDir, `${component.id}/compilation/index.js`)
    );

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
    const buildInstructions = recipeLogicProvider.getRecipeClass(component.id);

    expect(buildInstructions).to.be.a('Function');
    const classText = recipeText.match(/(class.*)/)[1];
    expect(buildInstructions.toString()).to.be.eql(classText);
  });
  it('throws an error if several recipes are found', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);
    fs.mkdirSync(path.join(test.componentDir, 'extra-folder'));
    fs.mkdirSync(path.join(test.componentDir, 'extra-folder', component.id));
    fs.writeFileSync(path.join(test.componentDir, 'extra-folder', component.id, 'index.js'), 'test');

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
    expect(() => recipeLogicProvider.findRecipeFolder(component.id)).to.throw(
      `Found several possible recipe directories for ${component.id} in ${test.componentDir}`
    );
  });
  it('loads the build instructions of a recipe', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
    const buildInstructions = recipeLogicProvider.loadBuildInstructions(component.id);

    expect(buildInstructions).to.be.a('Function');
  });
  it('loads the build instructions of a recipe using a directory', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
    const recipeDir = recipeLogicProvider.findRecipeFolder(component.id);
    const buildInstructions = recipeLogicProvider.loadBuildInstructions(component.id, recipeDir);

    expect(buildInstructions).to.be.a('Function');
  });
  it('exposes global functionalities for build instructions', function() {
    const test = helpers.createTestEnv();
    const config = new DummyConfigHandler(JSON.parse(fs.readFileSync(test.configFile, {encoding: 'utf8'})));
    const component = helpers.createComponent(test);
    const component2 = helpers.createComponent(test, {id: 'component2'});

    const recipeLogicProvider = new RecipeLogicProvider([test.componentDir], config.get('componentTypeCollections'));
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
    const Test = recipeLogicProvider.getRecipeClass(component2.id);
    const componentInstance = new Test();

    expect(componentInstance.initialize).to.not.throw();
  });
});

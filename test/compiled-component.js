'use strict';

const CompiledComponent = require('../compiled-component');
const path = require('path');
const fs = require('fs');
const chai = require('chai');
const chaiFs = require('chai-fs');
chai.use(chaiFs);
const helpers = require('blacksmith-test');
const expect = chai.expect;

describe('CompiledComponent', () => {
  let metadata = {};

  before('configure metadata', () => {
    metadata = {
      'id': 'sample',
      'version': '1.0.0'
    };
  });

  describe('CompiledComponent~install', () => {
    let compiledComponent = null;
    let testEnv = null;

    beforeEach('prepare compiled component', () => {
      helpers.cleanTestEnv();
      testEnv = helpers.createTestEnv();
      compiledComponent = new CompiledComponent(metadata);
    });

    afterEach('clean environment', () => {
      helpers.cleanTestEnv();
    });

    it('"install" method should copy files', () => {
      compiledComponent.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, {});
      fs.mkdirSync(path.join(testEnv.sandbox, 'sample-1.0.0'));
      fs.writeFileSync(path.join(testEnv.sandbox, 'sample-1.0.0', 'example'), '');
      compiledComponent.install();
      expect(path.join(testEnv.prefix, 'sample', 'example')).to.be.a.file();
    });
  });
});

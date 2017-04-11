'use strict';
/* eslint-disable no-unused-expressions */

const Component = require('../../lib/base-components/component');
const helpers = require('../helpers');
const path = require('path');
const fs = require('fs');
const chai = require('chai');
const chaiFs = require('chai-fs');
const expect = chai.expect;
chai.use(chaiFs);

describe('Component', () => {
  let metadata = {};

  before('configure metadata', () => {
    metadata = {
      'id': 'sample',
      'version': '1.0.0'
    };
  });

  describe('Component~setup', () => {
    let component = null;

    before('prepare component', () => {
      component = new Component(metadata);
    });

    it('"setup" method should set the parameters "be" and "componentList" properly', () => {
      const componentList = {
        be: 'sampleBE'
      };
      component.setup(componentList);
      expect(component.componentList).to.be.eql(componentList);
      expect(component.be).to.be.eql('sampleBE');
    });
  });

  describe('Component~getter', () => {
    let component = null;
    const dir = '/tmp/blacksmith_test_env';
    const prefixDir = path.join(dir, 'prefix');
    const sandboxDir = path.join(dir, 'sandbox');

    before('prepare environment', () => {
      const be = {
        prefixDir: prefixDir,
        sandboxDir: sandboxDir
      };
      component = new Component(metadata);
      component.setup({be}, {});
    });

    it('should return the prefix', () => {
      expect(component.prefix).to.be.eql(path.join(prefixDir, 'sample'));
    });

    it('should return the srcDir', () => {
      expect(component.srcDir).to.be.eql(path.join(sandboxDir, 'sample-1.0.0'));
    });

    it('should return the workingDir', () => {
      expect(component.workingDir).to.be.eql(path.join(sandboxDir, 'sample-1.0.0'));
    });

    it('should return the licenseDir', () => {
      expect(component.licenseDir).to.be.eql(path.join(prefixDir, 'sample', 'licenses'));
    });

    it('should return the extraFilesDir', () => {
      expect(component.extraFilesDir).to.be.eql(path.join(sandboxDir, 'sample-1.0.0', 'extra-files'));
    });

    it('should return the files to pick', () => {
      expect(component.pick).to.be.eql([]);
    });

    it('should return the files to exclude', () => {
      expect(component.exclude).to.be.eql(['.git', '.__empty_dir']);
    });
  });

  describe('Component~validate', () => {
    let component = null;

    beforeEach('initialize component', () => {
      component = new Component(metadata);
    });

    it('"validate" method should throw an error if metadata is empty', () => {
      component.metadata = '';
      component.setup({be: null}, null);
      expect(() => component.validate()).to.throw('You must configure some software product to build');
    });

    it('"validate" method should throw an error if "id", "version" or "licenses" is not provided', () => {
      component.metadata = {id: '', version: '', licenses: ''};
      component.setup({be: null}, null);
      expect(() => component.validate()).to.throw('Some errors were found validating  ' +
                                                  'formula:\n You must provide a proper \'id\' for you component\n' +
                                                  'You must provide a proper \'version\' for you component\n' +
                                                  'You must provide a proper \'licenses\' for you component');
    });
  });

  describe('Component~fulfillLicenseRequirements', () => {
    let component = null;
    let testEnv = null;

    beforeEach('initialize component and environment', () => {
      helpers.cleanTestEnv();
      testEnv = helpers.createTestEnv();
      component = new Component(metadata);
    });

    afterEach('clean environment', () => {
      helpers.cleanTestEnv();
    });

    it('"fulfillLicenseRequirements" method should show a warning if ' +
    'there is no license defined in the metadata', () => {
      component.setup({be: null}, null);
      component.metadata.licenses = [];
      let log = '';
      component.logger.debug = (msg) => log += msg;
      component.fulfillLicenseRequirements();
      expect(log).to.contain(
        `Skipping license propagation. There is no license information available for ${component.id}`
      );
    });

    it('"fulfillLicenseRequirements" method should throw an error if "main" attribute is not defined', () => {
      component.setup({be: null}, null);
      component.metadata.licenses = [
        {type: 'MIT', licenseRelativePath: 'LICENSE'},
        {type: 'BSD3', licenseRelativePath: 'LICENSE'}
      ];
      expect(() => {
        component.fulfillLicenseRequirements();
      }).to.throw('You should define a main license between MIT,BSD3');
    });

    it('"fulfillLicenseRequirements" method should throw an error if license file does not exist', () => {
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
      component.metadata.licenses = [{type: 'BSD3', licenseRelativePath: 'LICENSE'}];
      expect(() => component.fulfillLicenseRequirements()).to
        .throw(`License file '/tmp/blacksmith_test_env/sandbox/sample-1.0.0/LICENSE' does not exist`);
    });

    it('"fulfillLicenseRequirements" method should throw an error if ' +
    'licenseRelativePath, licenseUrl or CUSTOM license are not specified', () => {
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
      component.metadata.licenses = [{type: 'BSD3'}];
      expect(() => component.fulfillLicenseRequirements()).to
        .throw('You should specify either a licenseRelativePath or a licenseUrl for a CUSTOM license');
    });

    it('"fulfillLicenseRequirements" method should copy the main existing license', () => {
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
      component.metadata.licenses = [
        {type: 'BSD3', licenseRelativePath: 'LICENSE'},
        {type: 'APACHE2', licenseRelativePath: 'LICENSE2', main: true}
      ];
      fs.mkdirSync(path.join(testEnv.sandbox, 'sample-1.0.0'));
      fs.writeFileSync(path.join(testEnv.sandbox, 'sample-1.0.0', 'LICENSE'), 'License');
      fs.writeFileSync(path.join(testEnv.sandbox, 'sample-1.0.0', 'LICENSE2'), 'License2');
      component.fulfillLicenseRequirements();
      expect(component.mainLicense).to.be.deep.eql(component.metadata.licenses[1]);
      expect(path.join(component.licenseDir, 'sample-1.0.0.txt')).to.be.a.file().with.content('License2');
    });

    it('"fulfillLicenseRequirements" method should copy the existing license', () => {
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
      component.metadata.licenses = [{type: 'BSD3', licenseRelativePath: 'LICENSE'}];
      fs.mkdirSync(path.join(testEnv.sandbox, 'sample-1.0.0'));
      fs.writeFileSync(path.join(testEnv.sandbox, 'sample-1.0.0', 'LICENSE'), 'License');
      component.fulfillLicenseRequirements();
      expect(component.mainLicense).to.be.deep.eql(component.metadata.licenses[0]);
      expect(path.join(component.licenseDir, 'sample-1.0.0.txt')).to.be.a.file();
    });

    it('"fulfillLicenseRequirements" method should write the license with licenseUrl', () => {
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
      component.metadata.licenses = [{type: 'APACHE2', licenseUrl: 'http://www.apache.org/licenses/LICENSE-2.0'}];
      component.fulfillLicenseRequirements();
      expect(component.mainLicense).to.be.deep.eql(component.metadata.licenses[0]);
      expect(path.join(component.licenseDir, 'sample-1.0.0.txt'))
        .to.be.a.file().with.content('APACHE2: http://www.apache.org/licenses/LICENSE-2.0');
    });

    it('"fulfillLicenseRequirements" method should write the CUSTOM license', () => {
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
      component.metadata.licenses = [{type: 'CUSTOM'}];
      component.fulfillLicenseRequirements();
      expect(component.mainLicense).to.be.deep.eql(component.metadata.licenses[0]);
      expect(path.join(component.licenseDir, 'sample-1.0.0.txt'))
        .to.be.a.file().with.content('Distributed under CUSTOM license');
    });
  });

  describe('Component~cleanup', () => {
    let component = null;
    let testEnv = null;

    beforeEach('initialize component and environment', () => {
      helpers.cleanTestEnv();
      testEnv = helpers.createTestEnv();
      component = new Component(metadata);
    });

    afterEach('clean environment', () => {
      helpers.cleanTestEnv();
    });

    it('"cleanup" method should remove the srcDir', () => {
      component.setup({be: {refixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
      fs.mkdirSync(path.join(testEnv.sandbox, 'sample-1.0.0'));
      component.cleanup();
      expect(testEnv.sandbox).to.be.a.directory().and.empty;
    });
  });

  describe('Component~copyExtraFiles', () => {
    let component = null;
    let testEnv = null;

    beforeEach('initialize component and environment', () => {
      helpers.cleanTestEnv();
      testEnv = helpers.createTestEnv();
      component = new Component(metadata);
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
    });

    it('"copyExtraFiles" should throw an error if the path is not valid', () => {
      component.extraFiles = [null];
      fs.mkdirSync(path.join(testEnv.sandbox, 'sample-1.0.0'));
      expect(() => component.copyExtraFiles()).to.throw(
        'Wrong extraFiles defintion. Found null instead of a file path'
      );
    });

    it('"copyExtraFiles" should throw an error if the path is not absolute', () => {
      component.extraFiles = ['test'];
      fs.mkdirSync(path.join(testEnv.sandbox, 'sample-1.0.0'));
      expect(() => component.copyExtraFiles()).to.throw('Path to extraFiles should be absolute. Found test');
    });

    it('"copyExtraFiles" should copy two extra files', () => {
      const extraFiles = [path.join(testEnv.testDir, 'test1'), path.join(testEnv.testDir, 'test2')];
      extraFiles.forEach(extraFile => fs.writeFileSync(extraFile, ''));
      component.extraFiles = extraFiles;
      fs.mkdirSync(path.join(testEnv.sandbox, 'sample-1.0.0'));
      component.copyExtraFiles();
      const files = fs.readdirSync(path.join(testEnv.sandbox, 'sample-1.0.0', 'extra-files'));
      expect(files).to.be.eql(['test1', 'test2']);
    });

    it('"copyExtraFiles" should not create extra-files folder', () => {
      fs.mkdirSync(path.join(testEnv.sandbox, 'sample-1.0.0'));
      component.copyExtraFiles();
      expect(path.join(testEnv.sandbox, 'sample-1.0.0')).to.be.a.directory().and.to.be.empty;
    });
  });

  describe('Component~extract', () => {
    let component = null;
    let componentFixture = null;
    let testEnv = null;

    beforeEach('initialize component and environment', () => {
      helpers.cleanTestEnv();
      testEnv = helpers.createTestEnv();
      component = new Component(metadata);
      componentFixture = helpers.createComponent(testEnv, metadata);
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
    });

    it('"extract" should throw an error if the path is not set', () => {
      component.source.tarball = null;
      expect(() => component.extract()).to.throw('The source tarball is missing. Received null');
    });

    it('"extract" should throw an error if the path is not absolute', () => {
      component.source.tarball = 'tarball.tar.gz';
      expect(() => component.extract()).to.throw('Path to source tarball should be absolute. Found tarball.tar.gz');
    });

    it('"extract" should throw an error if the checksum does not match', () => {
      component.source.tarball = componentFixture.source.tarball;
      component.source.sha256 = '1234';
      expect(() => component.extract()).to.throw(
        `Calculated SHA256 of ${componentFixture.source.tarball} (${componentFixture.source.sha256})` +
        ` doesn't match the given one (1234)`
      );
    });

    it('"extract" should unpack tarball', () => {
      component.source.tarball = componentFixture.source.tarball;
      component.source.sha256 = componentFixture.source.sha256;
      component.extract();
      expect(path.join(
        testEnv.sandbox, `${component.metadata.id}-${component.metadata.version}`, 'exampleA/exampleA.txt'
      )).to.be.a.file();
    });
  });

  describe('Component~patch', () => {
    let component = null;
    let testEnv = null;

    beforeEach('initialize component and environment', () => {
      helpers.cleanTestEnv();
      testEnv = helpers.createTestEnv();
      component = new Component(metadata);
      component.setup({be: {prefixDir: testEnv.prefix, sandboxDir: testEnv.sandbox}}, null);
    });

    afterEach('clean environment', () => {
      helpers.cleanTestEnv();
    });

    it('"patch" method should throw an error if the path is not valid', () => {
      component.patches = [null];
      expect(() => component.patch()).to.throw('Wrong patches defintion. Found null instead of a file path');
    });

    it('"patch" method should throw an error if the path is not absolute', () => {
      component.patches = ['test'];
      expect(() => component.patch()).to.throw('Path to patches should be absolute. Found test');
    });

    it('"patch" method should execute the patch in the file', () => {
      component.patches = [path.join(__dirname, 'fixtures', 'patch')];
      const sampleDir = path.join(testEnv.sandbox, 'sample-1.0.0');
      fs.mkdirSync(sampleDir);
      fs.writeFileSync(
        path.join(sampleDir, 'file'),
        'Que dise usteer llevame al sircoo al ataquerl a gramenawer.\n'
      );
      component.logger = helpers.getDummyLogger();
      component.patch();
      expect(path.join(sampleDir, 'file')).to.have.content(
        'Benemeritaar no te digo trigo por no llamarte Rodrigor diodeno se calle ustee.\n'
      );
    });
  });
});

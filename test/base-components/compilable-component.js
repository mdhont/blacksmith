'use strict';
/* eslint-disable no-unused-expressions */
const CompilableComponent = require('../../lib/base-components/compilable-component');
const helpers = require('../helpers');
const path = require('path');
const fs = require('fs');
const chai = require('chai');
const chaiFs = require('chai-fs');
const nfile = require('nami-utils').file;
const spawnSync = require('child_process').spawnSync;
const expect = chai.expect;
chai.use(chaiFs);

describe('CompilableComponent', () => {
  let metadata = {};

  before('prepare metadata', () => {
    metadata = {
      id: 'sample',
      latest: '1.0.0'
    };
  });

  describe('CompilableComponent~getters', () => {
    let compilableComponent = null;
    const dir = '/tmp/blacksmith_test_env';
    const prefixDir = path.join(dir, 'prefix');

    before('prepare compilable component', () => {
      compilableComponent = new CompilableComponent(metadata.id, metadata.latest, {}, metadata);
      compilableComponent.setup({be: {prefixDir: prefixDir}}, {});
    });

    it('"libDir" method should return lib path', () => {
      expect(compilableComponent.libDir).to.be.deep.eq; (path.join(prefixDir, 'sample', 'lib'));
    });

    it('"binDir" method should return bin path', () => {
      expect(compilableComponent.binDir).to.be.deep.eql(path.join(prefixDir, 'sample', 'bin'));
    });

    it('"headersDir" method should return headers path', () => {
      expect(compilableComponent.headersDir).to.be.deep.eql(path.join(prefixDir, 'sample', 'include'));
    });
  });

  describe('CompilableComponent - environment variable methods', () => {
    let compilableComponent = null;
    const dir = '/tmp/blacksmith_test_env';

    beforeEach('prepare compilable component', () => {
      compilableComponent = new CompilableComponent(metadata.id, metadata.latest, {}, metadata);
      compilableComponent.setup({be: {prefixDir: path.join(dir, 'prefix')}});
    });

    it('"getOwnEnvironmentVariables" method should return an empty object', () => {
      expect(compilableComponent.getOwnEnvironmentVariables()).to.be.empty;
    });

    it(`"getExportableEnvironmentVariables" method should return the flags properly`, () => {
      const result = {
        CPPFLAGS: ['-I/tmp/blacksmith_test_env/prefix/sample/include'],
        LDFLAGS: ['-L/tmp/blacksmith_test_env/prefix/sample/lib',
                   '-Wl,-rpath=/tmp/blacksmith_test_env/prefix/sample/lib'
                 ],
        PATH: ['/tmp/blacksmith_test_env/prefix/sample/bin']
      };
      if (process.platform === 'linux') {
        result.LD_LIBRARY_PATH = ['/tmp/blacksmith_test_env/prefix/sample/lib'];
      } else if (process.platform === 'darwin') {
        result.DYLD_LIBRARY_PATH = ['/tmp/blacksmith_test_env/prefix/sample/lib'];
      }
      expect(
        compilableComponent.getExportableEnvironmentVariables()
      ).to.be.deep.equal(result);
    });
  });

  describe('CompilableComponent~minify', () => {
    let compilableComponent = null;
    let testEnv = null;
    let sampleDir = '';

    beforeEach('prepare compilable component', () => {
      helpers.cleanTestEnv();
      testEnv = helpers.createTestEnv();
      sampleDir = path.join(testEnv.prefix, 'sample');
      fs.mkdirSync(sampleDir);
      [
        'test.a', 'test.o', 'test.la', 'test.log',
        'ImageMagick.a', 'libruby-static.a', 'libv8.test.a',
        'test'
      ].forEach((file) => {
        fs.writeFileSync(path.join(sampleDir, file), '');
      });
      ['man', 'docs'].forEach((folder) => {
        fs.mkdirSync(path.join(sampleDir, folder));
        fs.writeFileSync(path.join(sampleDir, folder, 'example'), '');
      });
      compilableComponent = new CompilableComponent(metadata.id, metadata.latest, {}, metadata);
      compilableComponent.setup({be: {prefixDir: testEnv.prefix}}, null);
    });

    afterEach('clean environment', () => {
      helpers.cleanTestEnv();
    });

    it('should clean up the sample folder with noDoc enable', () => {
      compilableComponent.minify();
      const files = fs.readdirSync(sampleDir);
      expect(files).to.be.deep.equal(
        ['ImageMagick.a', 'docs', 'libruby-static.a', 'libv8.test.a', 'man', 'test']
      );
      expect(path.join(sampleDir, 'man')).to.be.a.directory().and.empty;
      expect(path.join(sampleDir, 'docs')).to.be.a.directory().and.empty;
    });

    it('should clean up the sample folder with noDoc disable', () => {
      compilableComponent.noDoc = false;
      compilableComponent.minify();
      const files = fs.readdirSync(sampleDir);
      expect(files).to.be.deep.equal(
        ['ImageMagick.a', 'docs', 'libruby-static.a', 'libv8.test.a', 'man', 'test']
      );
      expect(path.join(sampleDir, 'man', 'example')).to.be.a.file();
      expect(path.join(sampleDir, 'docs', 'example')).to.be.a.file();
    });

    it('should strip example binary', () => {
      testEnv.prefix = path.join(testEnv.prefix, 'sample');
      const component = helpers.createComponent(testEnv);
      spawnSync('tar', ['zvxf', component.source.tarball], {
        cwd: testEnv.prefix
      });
      ['ImageMagick', 'testfonts'].forEach((bin) => {
        nfile.copy(path.join(testEnv.prefix, 'example'), path.join(testEnv.prefix, bin));
      });
      const nonStrippedFileSize = fs.statSync(path.join(testEnv.prefix, 'example')).size;
      compilableComponent.minify();
      expect(fs.statSync(path.join(testEnv.prefix, 'example')).size).to.be.below(nonStrippedFileSize);
      expect(fs.statSync(path.join(testEnv.prefix, 'ImageMagick')).size).to.be.equal(nonStrippedFileSize);
      expect(fs.statSync(path.join(testEnv.prefix, 'testfonts')).size).to.be.equal(nonStrippedFileSize);
      const files = fs.readdirSync(testEnv.prefix);
      ['ImageMagick', 'ImageMagick.a', 'docs', 'example', 'libruby-static.a',
      'libv8.test.a', 'man', 'test', 'testfonts'].forEach((ff) => expect(files).to.contain(ff));
      expect(path.join(sampleDir, 'man')).to.be.a.directory().and.empty;
      expect(path.join(sampleDir, 'docs')).to.be.a.directory().and.empty;
    });

    it('should strip example binary with spaces in the filename', () => {
      testEnv.prefix = path.join(testEnv.prefix, 'sample');
      const component = helpers.createComponent(testEnv);
      spawnSync('tar', ['zvxf', component.source.tarball], {
        cwd: testEnv.prefix
      });
      const nonStrippedFileSize = fs.statSync(path.join(testEnv.prefix, 'example')).size;
      nfile.rename(path.join(testEnv.prefix, 'example'), path.join(testEnv.prefix, 'example with spaces'));
      compilableComponent.minify();
      expect(fs.statSync(path.join(testEnv.prefix, 'example with spaces')).size).to.be.below(nonStrippedFileSize);
    });
  });
});

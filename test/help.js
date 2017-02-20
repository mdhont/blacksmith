'use strict';

const _ = require('lodash');
const XRegExp = require('xregexp');
const chai = require('chai');
const chaiFs = require('chai-fs');
const chaiSubset = require('chai-subset');
const expect = chai.expect;
const fs = require('fs');
const helpers = require('./helpers');
const BlacksmithHandler = helpers.Handler;
const BlacksmithApp = require('../cli/blacksmith-app');
chai.use(chaiSubset);
chai.use(chaiFs);

describe('Blacksmith App', function() {
  this.timeout(15000);
  describe('Command Line', function() {
    afterEach(helpers.cleanTestEnv);
    const blacksmithHandler = new BlacksmithHandler();
    it('throws an error if no config file is found', function() {
      expect(() => new BlacksmithApp('no-exists')).to.throw('Configuration file not found');
    });
    it('installs a default configuration', function() {
      const test = helpers.createTestEnv();
      fs.renameSync(test.configFile, `${test.configFile}.sample`);
      let stdout = '';
      const stdoutWrite = process.stdout.write;
      try {
        process.stdout.write = (string) => stdout += `${string}\n`;
        new BlacksmithApp(test.configFile); // eslint-disable-line no-new
        process.stdout.write = stdoutWrite;
      } catch (e) {
        process.stdout.write = stdoutWrite;
        throw e;
      }
      expect(stdout).to.contain('Installing sample configuration');
      expect(test.configFile).to.be.file();
    });
    describe('Help Menu', function() {
      function getOptionReText(name, options) {
        options = _.defaults(options || {}, {default: '.*', type: 'string', allowed: '.*'});
        let text = `--${name}`;
        if (options.type !== 'boolean') {
          text += `\\s+\\<${name}\\>\\s+.*\\n+\\s*Default:\\s${options.default}\\n`;
        } else {
          text += `\\s+.*\\n+`;
        }
        if (options.type === 'choice' || options.allowed !== '.*') text += `\\s*Allowed:\\s${options.allowed}`;
        return `${text}\\n+`;
      }
      function getHelpRe(extraRe) {
          // XRegExp uses this naming and usage
          /* eslint-disable new-cap, no-useless-escape, prefer-template */
        const mainHelpRe = XRegExp(
          '\nUsage: blacksmith \<options\> \<command\>\n*'
          + '\\s+where \<options\> include:\n+'
          + '--help\\s+\n+'
          + getOptionReText('log-level', {default: 'info', allowed: 'trace, debug, info, warn, error, silent'})
          + getOptionReText('log-file')
          + getOptionReText('config')
          + getOptionReText('version', {type: 'boolean'})
          + 'And \<command\> is one of: configure, inspect, build, containerized-build, shell\\n+'
          + 'To get more information about a command, you can execute:\\n+'
          + `\\s*blacksmith \<command\> --help\\n+${extraRe || ''}$`
        );
        /* eslint-enable new-cap, no-useless-escape, prefer-template */
        return mainHelpRe;
      }
      it('appears when called without arguments', function() {
        const stdout = blacksmithHandler.exec('').stdout;
        expect(stdout).to.match(getHelpRe());
      });
      it('appears when called with --help', function() {
        const stdout = blacksmithHandler.exec('--help').stdout;
        expect(stdout).to.match(getHelpRe());
      });
      it('appears when called with wrong commands, as well as an error message', function() {
        const result = blacksmithHandler.exec('asdf', {abortOnError: false});
        expect(result.stdout).to.match(getHelpRe());
          // blacksmith ERROR Unknown command 'asdf'
        expect(result.stderr).to.match(/Unknown command 'asdf'/);
        expect(result.status).to.be.eql(1);
      });
    });
    describe('Version Menu', function() {
      it('appears when called with --version', function() {
        const stdout = blacksmithHandler.exec('--version').stdout;
          // expects something like `1.0.0`, `1.0.0-alpha1`,
          // `1.0.0 (2016-02-17 12:59:20)` or `1.0.0-alpha1 (2016-02-17 12:59:20)`
          /* eslint-disable max-len */
        expect(stdout).to.match(/^((\d+\.)?(\d+\.)?(\*|\d+))(-([a-zA-Z0-9_])+)?(\s\(([0-9]){4}-([0-9]){2}-([0-9]){2}\s([0-9]){2}:([0-9]){2}:([0-9]){2}\))?\n$/);
          /* eslint-enable max-len */
      });
    });
  });
});

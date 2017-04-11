'use strict';

const _ = require('lodash');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const spawnSync = require('child_process').spawnSync;
const testDir = '/tmp/blacksmith_test_env';
const nock = require('nock');
const os = require('os');

function createTestEnv(conf) {
  const componentDir = path.join(testDir, 'componentDir');
  const prefix = path.join(testDir, 'prefix');
  const sandbox = path.join(testDir, 'sandbox');
  const buildDir = path.join(testDir, 'builddir');
  const assetsDir = path.join(testDir, 'assets');
  _.each([testDir, componentDir, prefix, sandbox, buildDir, assetsDir], d => fs.mkdirSync(d));
  const _conf = _.defaults(conf || {}, {
    'compilation': {
      'prefix': prefix
    },
    'paths': {
      'sandbox': sandbox,
      'recipes': [componentDir],
      'output': testDir
    },
    'componentTypeCollections': [],
    'metadataServer': {
      'activate': false,
      'prioritize': false,
      'endPoint': null
    },
    'containerizedBuild': {
      'images': [
        {
          'id': 'gcr.io/bitnami-containers/bitnami-base-buildpack:r1',
          'platform': {
            'os': 'linux',
            'arch': 'x64',
            'distro': 'debian',
            'version': '8'
          }
        }
      ]
    }
  });
  const configFile = path.join(buildDir, 'config.json');
  fs.writeFileSync(configFile, JSON.stringify(_conf, null, 2));
  return {
    testDir,
    assetsDir,
    componentDir,
    prefix,
    sandbox,
    buildDir,
    configFile
  };
}

function cleanTestEnv() {
  spawnSync('rm', ['-rf', testDir]);
}

function createComponent(test, options) {
  options = _.defaults(options || {}, {
    id: 'sample1',
    version: '1.0.0',
    licenseType: 'BSD3',
    licenseRelativePath: 'LICENSE',
    licenseUrl: 'http://license.org'
  });
  const componentId = options.id;
  const componentVersion = options.version;

  fs.mkdirSync(path.join(test.componentDir, componentId));
  const recipeLogicPath = path.join(test.componentDir, `${componentId}/index.js`);
  fs.writeFileSync(recipeLogicPath, `
    'use strict';
    class ${componentId} extends Library {}
    module.exports = ${componentId};`);
  const metadata = {
    'id': componentId,
    'latest': componentVersion,
    'licenses': [
      {
        'type': options.licenseType,
        'licenseRelativePath': options.licenseRelativePath,
        'url': options.licenseUrl,
        'main': true
      }
    ]
  };
  fs.writeFileSync(path.join(test.componentDir, `${componentId}/metadata.json`), JSON.stringify(metadata, null, 2));
  spawnSync('tar', [
    'zcf', `${componentId}-${componentVersion}.tar.gz`,
    '-C', path.join(__dirname, 'assets/sample')].concat(
    fs.readdirSync(path.join(__dirname, 'assets/sample'))), {cwd: test.assetsDir});
  const checksum = crypto
    .createHash('sha256')
    .update(fs.readFileSync(path.join(test.assetsDir, `${componentId}-${componentVersion}.tar.gz`)))
    .digest('hex');
  const buildSpec = {
    platform: {os: os.platform(), arch: os.arch(), distro: 'debian', version: '8'},
    components: [
      {
        id: componentId,
        version: componentVersion,
        recipeLogicPath,
        metadata,
        source: {
          tarball: path.join(test.assetsDir, `${componentId}-${componentVersion}.tar.gz`),
          sha256: checksum
        }
      }
    ]
  };
  const buildSpecFile = path.join(test.componentDir, `${componentId}.json`);
  fs.writeFileSync(buildSpecFile, JSON.stringify(buildSpec, null, 2));
  return {
    id: componentId,
    version: componentVersion,
    source: {
      tarball: path.join(test.assetsDir, `${componentId}-${componentVersion}.tar.gz`),
      sha256: checksum
    },
    licenseRelativePath: options.licenseRelativePath,
    licenseType: options.licenseType,
    licenseUrl: options.licenseUrl,
    buildSpec,
    buildSpecFile
  };
}

function _noop() {}
function getDummyLogger(log) {
  const logger = {};
  if (log) log.text = '';
  _.each(['info', 'debug', 'error', 'warn',
  'trace', 'trace1', 'trace2', 'trace3', 'trace4', 'trace5', 'trace6', 'trace7', 'trace8'], level => {
    if (log) {
      logger[level] = function(msg) {
        log.text += `${level}: ${msg}\n`;
      };
    } else {
      logger[level] = _noop;
    }
  });
  return logger;
}

function addComponentToMetadataServer(server, component, response) {
  const jsonResponse = _.defaults({}, response, {
    'name': component.version,
    'key': component.id,
    'latest': component.version,
    'licenses': [
      {
        'main': true,
        'license_relative_path': component.licenseRelativePath,
        'url': component.licenseUrl,
        'name': component.licenseType
      }
    ],
    'vulnerabilities': []
  });
  nock(server).persist()
      .get('')
      .reply(200, JSON.stringify({'status': 'ok', 'version': 'v1'}));
  nock(server).persist()
      .get(`/components/${component.id}/latest`)
      .reply(200, JSON.stringify(jsonResponse));
  const majorVersion = component.version.split('.')[0];
  const minorVersion = component.version.split('.')[1];
  nock(server).persist()
      .get(`/components/${component.id}/~%3E${majorVersion}`)
      .reply(200, JSON.stringify(jsonResponse));
  nock(server).persist()
      .get(`/components/${component.id}/~%3E${majorVersion}.${minorVersion}`)
      .reply(200, JSON.stringify(jsonResponse));
  nock(server).persist()
      .get(`/components/${component.id}/~%3E${majorVersion}.${minorVersion}.0`)
      .reply(200, JSON.stringify(jsonResponse));
  nock(server).persist()
      .get(`/components/${component.id}/versions/${component.version}`)
      .reply(200, JSON.stringify(jsonResponse));
}

function addNotFoundEntries(server, paths) {
  _.each(paths, p => {
    p = p.replace(/~([0-9])/, '~%3E$1');
    nock(server).persist().get(p).reply(404, 'Not found');
  });
}

function getDummyBuildEnvironment(test, config) {
  const result = _.defaults(config || {}, {
    platform: {os: os.platform(), arch: os.arch(), distro: 'debian', version: '8'},
    outputDir: test.buildDir,
    prefixDir: test.prefix,
    maxParallelJobs: Infinity,
    sandboxDir: test.sandbox,
    artifactsDir: path.join(test.buildDir, 'artifacts'),
    logsDir: path.join(test.buildDir, 'logs')
  });
  result.target = {
    platform: result.platform,
    isUnix: true
  };
  result.envVars = {};
  result.addEnvVariable = (k, v) => result.envVars[k] = v;
  result.addEnvVariables = (vv) => _.each(vv, (v, k) => result.addEnvVariable(k, v));
  result.getEnvVariables = () => result.envVars;
  result.resetEnvVariables = () => result.envVars = {};
  return result;
}

function createDummyExecutable(filePath) {
  spawnSync('mkdir', ['-p', path.dirname(filePath)]);
  const fileContent = `#!/bin/bash
  echo $@
  exit 0`;
  fs.writeFileSync(filePath, fileContent, {mode: '0755'});
  return filePath;
}

module.exports = {
  createTestEnv,
  cleanTestEnv,
  createComponent,
  getDummyLogger,
  addComponentToMetadataServer,
  addNotFoundEntries,
  Handler: require('./handler'),
  DummyConfigHandler: require('./configHandler'),
  getDummyBuildEnvironment,
  createDummyExecutable
};

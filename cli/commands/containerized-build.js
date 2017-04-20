'use strict';


const ContainerizedBuilder = require('../../lib/containerized-builder');
const nfile = require('nami-utils').file;
const _ = require('lodash');
const dockerUtils = require('docker-utils');
const utils = require('common-utils');

module.exports = [{
  name: 'containerized-build', minArgs: 1, maxArgs: 1, namedArgs: ['buildSpec'],
  callback: function(parser) {
    function callback() {
      dockerUtils.verifyConnection();
      const opts = _.defaults(parser.parseOptions(this, {camelize: true}), {
        abortOnError: true, forceRebuild: false, imageId: null,
        incrementalTracking: true, continueAt: null,
        modulesPaths: parser.blacksmith.config.get('paths.tarballs')
      });
      let buildData = null;
      try {
        buildData = utils.parseJSONFile(this.arguments.buildSpec, {
          schemaFile: nfile.join(__dirname, '../../schemas/containerized-build.json')
        });
      } catch (e) {
        throw new Error(`Unable to parse ${this.arguments.buildSpec}. Received:\n${e.message}`);
      }
      buildData.platform = _.defaults(buildData.platform, {
        os: opts.os,
        arch: opts.arch,
        distro: opts.distro,
        version: opts.distroVersion
      });
      const containerizedBuilder = new ContainerizedBuilder(parser.blacksmith,
        _.assign({logger: parser.blacksmith.logger}, opts));
      const availableImages = parser.configHandler.get('containerizedBuild.images');
      if (_.isEmpty(availableImages)) throw new Error(`Not found any available image in the configuration`);
      containerizedBuilder.build(buildData, availableImages, opts);
    }
    return callback;
  },
  options: [
      {name: 'force-rebuild', type: 'boolean',
      description: 'Force rebuilding of components'},
      {name: 'json', type: 'string', default: '',
      description: 'JSON file containing the specification of what to build'},
      {name: 'continue-at', description: 'Continue at a certain component in the list of components to build'},
      {name: 'incremental-tracking', type: 'boolean', default: true,
      description: 'Create separate tarballs for each of the individual components built'},
      {name: 'build-id', description: 'Build identifier used to name certain directories and tarballs. ' +
      'It defaults to the lastest built component'},
      {name: 'build-dir', description: 'Directory to use for storing build files, including the resulting artifacts'},
      {name: 'image-id', description: 'Docker image ID to use. Auto by default'},
      {name: 'os', description: 'Platform OS of the build', default: 'linux'},
      {name: 'arch', description: 'Platform Architecture of the build', default: 'x64'},
      {name: 'distro', description: 'Distribution of the build', default: 'debian'},
      {name: 'distro-version', description: 'Distribution version of the build', default: '8'}
  ], configurationBasedOptions: {
    'paths.output': {name: 'output', description: 'Output directory containing all build dirs'},
    'compilation.maxJobs': {name: 'max-jobs', description: 'Max parallel jobs. Defaults to the number of cores+1'},
    'compilation.prefix': {name: 'prefix', description: 'Compilation prefix'}
  }
}, {
  name: 'shell', minArgs: 1, maxArgs: 1, namedArgs: ['build-dir'],
  callback: function(parser) {
    function callback() {
      dockerUtils.verifyConnection();
      const opts = _.defaults(parser.parseOptions(this, {camelize: true}), {
        imageId: null,
        config: parser.blacksmith.config
      });
      const buildData = utils.parseJSONFile(nfile.join(this.arguments['build-dir'], 'config/containerized-build.json'));
      const containerizedBuilder = new ContainerizedBuilder(parser.blacksmith, opts);
      const previousConfig = utils.parseJSONFile(nfile.join(this.arguments['build-dir'], 'config/config.json'));
      const imageId = previousConfig.containerizedBuild.images[0].id;
      if (_.isEmpty(imageId)) throw new Error('Not found the image description in the previous build');
      containerizedBuilder.dockerShell(this.arguments['build-dir'], imageId, _.assign({buildData}, opts));
    }
    return callback;
  },
  options: [
        {name: 'image-id', description: 'Image ID to use'}
  ]
}];

'use strict';


const ContainerizedBuilder = require('../../lib/containerized-builder');
const nfile = require('nami-utils').file;
const _ = require('nami-utils/lodash-extra');
const dockerUtils = require('docker-utils');
const utilities = require('../../lib/containerized-builder/utilities');

module.exports = [{
  name: 'containerized-build', minArgs: 0, maxArgs: -1, namedArgs: ['package[@version]:/path/to/tarball'],
  callback: function(parser) {
    function callback() {
      dockerUtils.verifyConnection();
      const opts = _.opts(parser.parseOptions(this, {camelize: true}), {
        abortOnError: true, forceRebuild: false, imageId: null,
        incrementalTracking: true, continueAt: null,
        json: '', modulesPaths: parser.blacksmith.config.get('paths.tarballs')
      });
      const buildData = parser.parseRequestedComponents(this.providedArguments, opts.json);
      const containerizedBuilder = new ContainerizedBuilder(parser.blacksmith,
        _.assign({logger: parser.blacksmith.logger}, opts));
      const availableImages = parser.configHandler.get('containerizedBuild.images');
      if (_.isEmpty(availableImages)) throw new Error(`Not found any available image in the configuration`);
      const imageId = opts.imageId ||
        utilities.getImage(availableImages, buildData.platform);
      containerizedBuilder.build(buildData, imageId, opts);
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
      {name: 'image-id', description: 'Docker image ID to use. Auto by default'}
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
      const opts = _.opts(parser.parseOptions(this, {camelize: true}), {
        imageId: null,
        config: parser.blacksmith.config
      });
      const buildData = parser.parseRequestedComponents(null,
        nfile.join(this.arguments['build-dir'], 'config/components.json')
      );
      const containerizedBuilder = new ContainerizedBuilder(parser.blacksmith, opts);
      const availableImages = parser.blacksmith.config.get('containerizedBuild.images');
      const imageId = opts.imageId || utilities.getImage(availableImages);
      if (_.isEmpty(imageId)) throw new Error('Not found the image description in the previous build');
      containerizedBuilder.dockerShell(this.arguments['build-dir'], imageId, _.assign({buildData}, opts));
    }
    return callback;
  },
  options: [
        {name: 'image-id', description: 'Image ID to use'}
  ]
}];

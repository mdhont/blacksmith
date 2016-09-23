'use strict';

const ContainerizedBuilder = require('./lib/containerized-builder');
const nfile = require('nami-utils').file;
const _ = require('nami-utils/lodash-extra');
const dockerUtils = require('docker-utils');

module.exports = [{
  name: 'containerized-build', minArgs: 0, maxArgs: -1, namedArgs: ['package[@version]:/path/to/tarball'],
  callback: function(parser) {
    function callback() {
      dockerUtils.verifyConnection();
      const opts = _.opts(parser.parseOptions(this, {camelize: true}), {
        abortOnError: true, forceRebuild: false,
        containerRoot: null, imageId: null,
        incrementalTracking: true, continueAt: null,
        flavor: null, platform: 'linux-x64', json: '', modulesPaths: parser.blacksmith.config.get('paths.tarballs')
      });
      const buildData = parser.parseRequestedComponents(this.providedArguments, opts.json);
      const containerizedBuilder = new ContainerizedBuilder(parser.blacksmith,
        _.assign({logger: parser.blacksmith.logger}, opts));
      const imageId = _.isEmpty(opts.imageId) ?
        parser.configHandler.get('containerizedBuild.defaultImage') :
        opts.imageId;
      if (_.isEmpty(imageId)) throw new Error('You should configure a default image to use');
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
      {name: 'image-id', description: 'Docker image ID to use. Auto by default'},
      {name: 'platform', default: 'linux-x64', description: 'Platform to build for'},
      {name: 'flavor', default: '', description: 'Flavor of the build. Allows tweaking some of the components.' +
      'For example, \'alpine\', will make some Alpine patches to be applied'}
  ], configurationBasedOptions: {
    'paths.output': {name: 'output', description: 'Output directory containing all build dirs'},
    'compilation.maxJobs': {name: 'max-jobs', description: 'Max parallel jobs. Defaults to the number of cores+1'},
    'compilation.prefix': {name: 'prefix', description: 'Compilation prefix'}
  }
}, {
  name: 'shell', minArgs: 0, maxArgs: 0, namedArgs: ['build-dir'],
  callback: function(parser) {
    function callback() {
      dockerUtils.verifyConnection();
      const opts = _.opts(parser.parseOptions(this, {camelize: true}), {
        containerRoot: null,
        imageId: null,
        config: parser.blacksmith.config
      });
      const buildData = parser.parseRequestedComponents(null,
        nfile.join(this.arguments['build-dir'], 'config/components.json')
      );
      const containerizedBuilder = new ContainerizedBuilder(parser.blacksmith, opts);
      const imageId = _.isEmpty(opts.imageId) ?
        parser.configHandler.get('containerizedBuild.defaultImage') :
        opts.imageId;
      if (_.isEmpty(imageId)) throw new Error('You should configure a default image to use');
      containerizedBuilder.dockerShell(this.arguments['build-dir'], imageId, _.assign({buildData}, opts));
    }
    return callback;
  },
  options: [
        {name: 'image-id', description: 'Image ID to use'},
        {name: 'containerRoot', description: 'Root directory to map into the image'}
  ]
}];

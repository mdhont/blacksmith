'use strict';

const _ = require('lodash');
const nfile = require('nami-utils').file;
const utils = require('common-utils');

module.exports = {
  name: 'build', minArgs: 1, maxArgs: 1, namedArgs: ['buildSpec'],
  callback: function(parser) {
    function callback() {
      const opts = _.defaults({}, parser.parseOptions(this, {camelize: true}), {abortOnError: true, forceRebuild: false,
         incrementalTracking: false, continueAt: null});
      let buildData = null;
      try {
        buildData = utils.parseJSONFile(
          this.arguments.buildSpec,
          {schemaFile: nfile.join(__dirname, '../../schemas/build.json')}
        );
      } catch (e) {
        throw new Error(`Unable to parse ${this.arguments.buildSpec}. Received:\n${e.message}`);
      }
      buildData.platform = _.defaults(buildData.platform, {
        os: opts.os,
        arch: opts.arch,
        distro: opts.distro,
        version: opts.distroVersion
      });
      parser.blacksmith.build(buildData, opts);
    }
    return callback;
  }, options: [
     {name: 'force-rebuild', type: 'boolean', description: 'Force rebuilding of components'},
     {name: 'continue-at', description: 'Continue at a certain component in the list of components to build'},
     {name: 'incremental-tracking', type: 'boolean', default: false,
     description: 'Create separate tarballs for each of the individual components built'},
     {name: 'build-id', description: 'Build identifier used to name certain directories and tarballs. ' +
     'It defaults to the lastest built component'},
     {name: 'build-dir', description: 'Directory to use for storing build files, including the resulting artifacts'},
     {name: 'os', description: 'Platform OS of the build', default: 'linux'},
     {name: 'arch', description: 'Platform Architecture of the build', default: 'x64'},
     {name: 'distro', description: 'Distribution of the build', default: 'debian'},
     {name: 'distro-version', description: 'Distribution version of the build', default: '8'}
  ], configurationBasedOptions: {
    'compilation.maxJobs': {name: 'max-jobs', description: 'Max parallel jobs. Defaults to the number of cores+1'},
    'compilation.prefix': {name: 'prefix', description: 'Compilation prefix'}
  }
};

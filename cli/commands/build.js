'use strict';

const _ = require('lodash');
const nfile = require('nami-utils').file;
const utils = require('common-utils');

module.exports = {
  name: 'build', minArgs: 1, maxArgs: 1, namedArgs: ['buildSpec'],
  callback: function(parser) {
    function callback() {
      const opts = _.defaults({}, parser.parseOptions(this, {camelize: true}), {abortOnError: true, forceRebuild: false,
         incrementalTracking: false, continueAt: null, platform: null});
      let buildData = null;
      try {
        buildData = utils.parseJSONFile(
          this.arguments.buildSpec,
          {schemaFile: nfile.join(__dirname, '../../schemas/build.json')}
        );
      } catch (e) {
        throw new Error(`Unable to parse ${this.arguments.buildSpec}. Received:\n${e.message}`);
      }
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
     {name: 'build-dir', description: 'Directory to use for storing build files, including the resulting artifacts'}
  ], configurationBasedOptions: {
    'compilation.maxJobs': {name: 'max-jobs', description: 'Max parallel jobs. Defaults to the number of cores+1'},
    'compilation.prefix': {name: 'prefix', description: 'Compilation prefix'}
  }
};

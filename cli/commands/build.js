'use strict';

const _ = require('lodash');

module.exports = {
  name: 'build', minArgs: 0, maxArgs: -1, namedArgs: ['package[@version]:/path/to/tarball'],
  callback: function(parser) {
    function callback() {
      const opts = _.defaults({}, parser.parseOptions(this, {camelize: true}), {abortOnError: true, forceRebuild: false,
         containerRoot: null, incrementalTracking: false, continueAt: null, platform: null});
      const buildData = parser.parseRequestedComponents(this.providedArguments, opts.json);
      parser.blacksmith.build(buildData, opts);
    }
    return callback;
  }, options: [
     {name: 'force-rebuild', type: 'boolean', description: 'Force rebuilding of components'},
     {name: 'json', type: 'string', description: 'JSON file containing the specification of what to build'},
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

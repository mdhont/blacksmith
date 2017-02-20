'use strict';

const nfile = require('nami-utils').file;

module.exports = {
  name: 'inspect', minArgs: 0, maxArgs: -1, namedArgs: ['package[@version]:/path/to/tarball'],
  callback: function(parser) {
    function callback() {
      const opts = parser.parseOptions(this, {camelize: true});
      const componentsToList = parser.parseRequestedComponents(this.providedArguments, opts.json);
      const data = parser.blacksmith.bm.getComponentsMetadata(componentsToList, opts);
      const jsonOutput = JSON.stringify(data, null, 4);
      if (opts.outputFile) {
        nfile.write(opts.outputFile, jsonOutput);
      } else {
        console.log(jsonOutput);
      }
    }
    return callback;
  }, options: [
    {name: 'output-file'},
    {name: 'json', type: 'string', description: 'JSON file containing the specification of what to build'},
  ]
};

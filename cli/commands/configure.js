'use strict';

const nfile = require('nami-utils').file;
const _ = require('lodash');

module.exports = {
  name: 'configure', minArgs: 1, maxArgs: 2, namedArgs: ['property', 'value'],
  callback: function(parser) {
    function callback() {
      if (parser.getOption('config').provided) {
        throw new Error('You can only change the default configuration file. ' +
        'The --config option is not allowed with this command');
      }
      const action = this.getOptionValue('action');
      const config = JSON.parse(nfile.read(parser.configFile));
      const previousValue = _.get(config, this.arguments.property);
      if (_.isPlainObject(previousValue)) {
        const innerKeys = _.map(_.keys(previousValue), key => `${this.arguments.property}.${key}`);
        throw new Error(`${this.arguments.property} is an Object, ` +
          `you need to specify one of its properties: ${innerKeys.join(', ')}`);
      } else {
        if ((action === 'add' || action === 'set') && _.isEmpty(this.arguments.value)) {
          throw new Error('You need to specify a value');
        }
        switch (action) {
          case 'set':
            if (_.isArray(previousValue)) {
              _.set(config, this.arguments.property, [this.arguments.value]);
            } else {
              _.set(config, this.arguments.property, this.arguments.value);
            }
            break;
          case 'add':
            if (_.isArray(previousValue)) {
              _.set(config, this.arguments.property,
                _.get(config, this.arguments.property).concat(this.arguments.value)
              );
            } else {
              _.set(config, this.arguments.property, this.arguments.value);
            }
            break;
          case 'unset':
            config[this.arguments.property] = parser.configHandler.getDefaulValue(this.arguments.property) || null;
            break;
          default:
            throw new Error(`Option: ${action} not supported`);
        }
        nfile.write(parser.configFile, JSON.stringify(config, null, 2));
      }
    }
    return callback;
  }, options: [
    {
      name: 'action', type: 'choice', validValues: ['set', 'unset', 'add'], default: 'add',
      description: 'Set, unset or add a new value to the specified property'
    }
  ]
};

'use strict';

const nfile = require('nami-utils').file;
const _ = require('lodash');

function isJson(str) {
  try {
    const json = JSON.parse(str);
    return typeof json === 'object';
  } catch (e) {
    return false;
  }
}

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
      if (_.isPlainObject(previousValue) && !isJson(this.arguments.value)) {
        const innerKeys = _.map(_.keys(previousValue), key => `${this.arguments.property}.${key}`);
        throw new Error(`${this.arguments.property} is an Object, ` +
          `you need to specify one of its properties: ${innerKeys.join(', ')}`);
      } else {
        const value = isJson(this.arguments.value) ? JSON.parse(this.arguments.value) : this.arguments.value;
        if ((action === 'add' || action === 'set') && _.isEmpty(value)) {
          throw new Error('You need to specify a value');
        }
        switch (action) {
          case 'set':
            if (_.isArray(previousValue)) {
              _.set(config, this.arguments.property, [value]);
            } else {
              _.set(config, this.arguments.property, value);
            }
            break;
          case 'add':
            if (_.isArray(previousValue)) {
              _.set(config, this.arguments.property,
                _.get(config, this.arguments.property).concat(value)
              );
            } else {
              _.set(config, this.arguments.property, value);
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

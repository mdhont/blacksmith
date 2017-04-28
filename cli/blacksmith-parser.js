'use strict';

const _ = require('nami-utils/lodash-extra');
const Parser = require('cmd-parser').Parser;
const nfile = require('nami-utils').file;
const utils = require('common-utils');

/**
 * Class representing the Blacksmith CLI parser. The core commands are:
 *  - 'configure' modify blacksmith configuration
 *  - 'inspect' to show component properties
 *  - 'build' build components
 * @namespace BlacksmithParser
 * @class
 * @param {Object} blacksmith - {@link Blacksmith} instance to use
 * @param {Object} [options]
 * @param {string} [options.toolName='blacksmith'] - Name of the tool
 * @property {Object} configHandler - {@link Blacksmith.ConfigurationHandler ConfigurationHandler}
 * of the Blacksmith instance
 * @property {Object} blacksmith - {@link Blacksmith} instance
 */
class BlacksmithParser extends Parser {
  constructor(blacksmith, configFile) {
    super({toolName: 'blacksmith'});
    this.configFile = configFile;
    this.configHandler = blacksmith.config;
    this.blacksmith = blacksmith;
    this.populateBlacksmithCommands();
  }
  addCommand(cmdDefinition, cmdOptions, optionsFromCfg) {
    const cmd = super.addCommand(cmdDefinition, cmdOptions);
    this._addOptionsFromConfigHandler(cmd, optionsFromCfg);
    return cmd;
  }
  // optContainer can be either a parser or a command
  _addOptionFromConfigHandler(optContainer, optData, configKeyPath) {
    const configHandler = this.configHandler;
    optContainer.addOption(_.defaults(optData, {
      default: this.configHandler.get(configKeyPath),
      callback: function() {
        configHandler.set(configKeyPath, this.getValue());
      }
    }));
  }
  _addOptionsFromConfigHandler(optContainer, options) {
    _.each(options, (optData, configKeyPath) => {
      if (_.isString(optData)) {
        const optName = optData;
        optData = {name: optName};
      }
      this._addOptionFromConfigHandler(optContainer, optData, configKeyPath);
    });
  }
  parseOptions(command, options) {
    const json = {};
    // If the command has the 'json' option it can override default options
    const jsonOption = command.getOption('json');
    if (jsonOption && jsonOption.provided && !_.isEmpty(command.getOptionValue('json'))) {
      const jsonFile = command.getOptionValue('json');
      if (nfile.exists(jsonFile)) {
        const jsonInfo = utils.parseJSONFile(jsonFile);
        _.each(jsonInfo, (value, key) => json[_.camelCase(key)] = value);
      } else {
        throw new Error(`File ${jsonFile} not found`);
      }
    }
    const opts = command.getFlattenOptions(options);
    _.each(opts, (value, key) => {
      if (_.isEmpty(opts[key]) && !_.isEmpty(json[key])) opts[key] = json[key];
    });
    return opts;
  }

  populateBlacksmithCommands() {
    const parser = this;
    this.addOption({
      name: 'log-level',
      description: 'Configures the verbosity of blacksmith messages',
      defaultValue: parser.configHandler.get('logging.logLevel'),
      type: 'choice',
      hiddenValidValues: ['trace1', 'trace2', 'trace3', 'trace4', 'trace5', 'trace6', 'trace7', 'trace8'],
      allowedValues: ['trace', 'debug', 'info', 'warn', 'error', 'silent'],
      callback: function() {
        parser.configHandler.set('logging.logLevel', this.getValue());
        parser.blacksmith.reloadConfig();  // Setup blacksmith with the new options
      }
    });
    this.addOption({
      name: 'log-file',
      description: 'Configure log file',
      defaultValue: parser.configHandler.get('logging.logFile'),
      callback: function() {
        parser.configHandler.set('logging.logFile', this.getValue());
        parser.blacksmith.reloadConfig();  // Setup blacksmith with the new options
      }
    });
    this.addOption({
      name: 'config',
      description: 'Override default configuration',
      callback: function() {
        parser.configHandler.loadFile(this.getValue());
        parser.blacksmith.reloadConfig();  // Setup blacksmith with the new options
      }
    });
    this.addOption({
      name: 'version', description: 'Blacksmith Version',
      allowNegated: false, type: 'boolean', exitAfterCallBack: true,
      callback: () => {
        const packageInfo = JSON.parse(nfile.read(
          nfile.join(parser.configHandler.get('paths.rootDir'), 'package.json')));
        console.log(packageInfo.version);
      }
    });
    _.each([
      './commands/configure',
      './commands/build',
      './commands/containerized-build',
    ].concat(this.configHandler.get('plugins')),
      commands => {
        // Refresh cache if already loaded
        delete require.cache[require.resolve(commands)];
        const commandDefinitions = require(commands);
        _.each(_.flatten([commandDefinitions]), command => {
          if (_.isEmpty(command.name) || !_.isFunction(command.callback)) {
            throw new Error('You should specify at least a name and a callback function');
          }
          const cmd = this.addCommand({
            name: command.name,
            minArgs: command.minArgs || 0,
            maxArgs: command.maxArgs || -1,
            namedArgs: command.namedArgs || [],
          }, command.options, command.configurationBasedOptions || {});
          cmd.callback = command.callback(parser).bind(cmd);
        });
      });
  }
}

module.exports = BlacksmithParser;

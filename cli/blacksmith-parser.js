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
  constructor(blacksmith, options) {
    super(_.opts(options, {toolName: 'blacksmith'}));
    this.configHandler = blacksmith.config;
    this.blacksmith = blacksmith;
    this.populateBlacksmithCommands();
  }
  addCommand(cmdDefinition, cmdOptions, optionsFromCfg) {
    const cmd = super.addCommand(cmdDefinition, cmdOptions);
    this._addOptionsFromConfigHandler(cmd, optionsFromCfg);
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
  parseRequestedComponents(cliComponents, jsonSpecFile) {
    if (_.isEmpty(cliComponents) && _.isEmpty(jsonSpecFile)) {
      throw new Error('You must either provide a list of components or a JSON file with the build spec');
    }
    if (_.isEmpty(jsonSpecFile)) {
      return {components: cliComponents};
    } else {
      if (!nfile.exists(jsonSpecFile)) {
        throw new Error(`File ${jsonSpecFile} not found`);
      }
      const jsonSpec = utils.parseJSONFile(jsonSpecFile);
      if (!_.isEmpty(cliComponents)) {
        jsonSpec.components = (jsonSpec.components || []).concat(cliComponents);
      }
      return jsonSpec;
    }
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
    this.addCommand({
      name: 'configure', minArgs: 1, maxArgs: 2, namedArgs: ['property', 'value'],
      callback: function() {
        if (parser.getOption('config').provided) {
          throw new Error('You can only change the default configuration file. ' +
          'The --config option is not allowed with this command');
        }
        const action = this.getOptionValue('action');
        const configFile = nfile.join(parser.configHandler.get('paths.rootDir'), 'config.json');
        if (!nfile.exists(configFile)) throw new Error(`Unable to find the default config file at ${configFile}`);
        const config = JSON.parse(nfile.read(configFile));
        const previousValue = _.get(config, this.arguments.property);
        if (_.isReallyObject(previousValue)) {
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
          nfile.write(configFile, JSON.stringify(config, null, 2));
        }
      }
    }, [
      {
        name: 'action', type: 'choice', validValues: ['set', 'unset', 'add'], default: 'add',
        description: 'Set, unset or add a new value to the specified property'
      }
    ]);

    this.addCommand({
      name: 'inspect', minArgs: 0, maxArgs: -1, namedArgs: ['package[@version]:/path/to/tarball'],
      callback: function() {
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
    }, [
      {name: 'output-file'},
      {name: 'json', type: 'string', description: 'JSON file containing the specification of what to build'},
      {name: 'platform', default: 'linux-x64'},
      {name: 'flavor'}
    ]);

    this.addCommand({
      name: 'build', minArgs: 0, maxArgs: -1, namedArgs: ['package[@version]:/path/to/tarball'],
      callback: function() {
        const opts = _.opts(parser.parseOptions(this, {camelize: true}), {abortOnError: true, forceRebuild: false,
          containerRoot: null, incrementalTracking: false, continueAt: null, flavor: null, platform: 'linux-x64'});
        const buildData = parser.parseRequestedComponents(this.providedArguments, opts.json);
        parser.blacksmith.build(buildData, opts);
      }
    }, [
      {name: 'force-rebuild', type: 'boolean',
      description: 'Force rebuilding of components'},
      {name: 'json', type: 'string',
      description: 'JSON file containing the specification of what to build'},
      {name: 'continue-at', description: 'Continue at a certain component in the list of components to build'},
      {name: 'incremental-tracking', type: 'boolean', default: false,
      description: 'Create separate tarballs for each of the individual components built'},
      {name: 'build-id', description: 'Build identifier used to name certain directories and tarballs. ' +
      'It defaults to the lastest built component'},
      {name: 'build-dir', description: 'Directory to use for storing build files, including the resulting artifacts'},
      {name: 'platform', default: 'linux-x64', description: 'Platform to build for'},
      {name: 'flavor', default: '', description: 'Flavor of the build. Allows tweaking some of the components.' +
      'For example, \'alpine\', will make some Alpine patches to be applied'}
    ], {
      'compilation.maxJobs': {name: 'max-jobs', description: 'Max parallel jobs. Defaults to the number of cores+1'},
      'compilation.prefix': {name: 'prefix', description: 'Compilation prefix'}
    });
    _.each(this.configHandler.get('plugins'), extraCommands => {
      const commands = require(extraCommands);
      _.each(_.flatten([commands]), command => {
        if (_.isEmpty(command.name) || !_.isFunction(command.callback)) {
          throw new Error('You should specify at least a name and a callback function');
        }
        this.addCommand({
          name: command.name,
          minArgs: command.minArgs || 0,
          maxArgs: command.maxArgs || -1,
          namedArgs: command.namedArgs || [],
          callback: command.callback(this),
        }, command.options, command.configurationBasedOptions || {});
      });
    });
  }
}

module.exports = BlacksmithParser;

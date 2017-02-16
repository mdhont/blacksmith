'use strict';

const _ = require('nami-utils/lodash-extra');
const nhb = require('nami-utils/templates');

/**
 * Class representing the list of components to build
 * @namespace Blacksmith.BuildManager.ComponentList
 * @class
 * @param {Array|Object} buildData - Array of objects to build or Object including:
 * @param {Object} [buildData.platform] - Platform of the build
 * @param {Array} buildData.components - Array of components to build. Each component can be a string or
 * an object defining at least an 'id' (it can also inclde patches or additional files)
 * @param {Object} componentProvider - {@link ComponentProvider}
 * @param {Object} be - {@link Blacksmith.BuildEnvironment BuildEnvironment}
 * @param {Object} conf - ConfigurationHandler with the configuration
 * @param {Object} logger - Logger to use
 * @param {Object} [initializationOptions]
 * @param {Object} [initializationOptions.abortOnError=true] - Abort if a component validation returns an error
 * @param {Object} [initializationOptions.initialize=true] - Initialize components
 * @param {Object} [initializationOptions.validate=true] - Validate components
 */
class ComponentList {
  constructor(buildData, componentProvider, be, conf, logger, initOptions) {
    this.be = be;
    this.logger = logger;
    this._components = [];
    this._componentProvider = componentProvider;
    this._conf = conf;
    this._initializationOptions = _.opts(initOptions, {
      abortOnError: true, initialize: true, validate: true
    });
    const _buildData = _.isArray(buildData) ? buildData : buildData.components;
    _.each(_buildData, c => this.add(c));
  }

  /**
   * Add a component to the build list
   * @function Blacksmith.BuildManager.ComponentList~add
   * @param {Object} component - Component to add
   */
  add(component) {
    const _component = this._getComponent(component);
    // Check if component is already in the list to substitute it
    const previousObjIndex = _.findIndex(this._components, {id: _component.id});
    if (previousObjIndex !== -1) {
      // Merge component properties
      _.each(['metadata', 'patches', 'extraFiles', 'sourceTarball'], (k) => {
        if (_.isEmpty(_component[k]) && !_.isEmpty(this._components[previousObjIndex][k])) {
          _component[k] = this._components[previousObjIndex][k];
        }
      });
      this._components[previousObjIndex] = _component;
    } else {
      // Component is new
      this._components.push(_component);
    }
    this.be.addEnvVariables(_component.getExportableEnvironmentVariables());
  }

  /**
   * Returns a {@linkcode Component} from the build list
   * @function Blacksmith.BuildManager.ComponentList~get
   * @param {string} id - ID of the component
   * @returns {@linkcode Component}
   */
  get(id) {
    const res = _.find(this._components, (component) => component.id === id);
    if (_.isEmpty(res)) throw new Error(`${id} is not present in the list of components to build`);
    return res;
  }

  /**
   * Returns the full list of components
   * @function Blacksmith.BuildManager.ComponentList~getObjs
   * @returns {Array} Array of components
   */
  getObjs() {
    return this._components;
  }

  _getComponent(componentSpec) {
    const componentData = this._componentProvider.parseComponentReference(componentSpec);
    const obj = this._componentProvider.getComponent(componentData);
    obj.setup(this, {logger: this.logger});
    if (this._initializationOptions.initialize) obj.initialize();
    if (this._initializationOptions.validate) {
      try {
        obj.validate();
      } catch (e) {
        if (this._initializationOptions.abortOnError) {
          throw e;
        } else {
          this.logger.warn(`Component validation failed: ${e}`);
        }
      }
    }
    return obj;
  }

  /**
   * Populate flags using component context
   * @function Blacksmith.BuildManager.ComponentList~populateFlagsFromDependencies
   * @param {Object} [perDependencyFlags] - Object defining the flags and the components. The key will be the object ID
   * and the value will be an array of flags to populate
   * @returns {Array}
   * @example
   * populateFlagsFromDependencies({
   *   apache: ['--apache-prefix={{prefix}}']
   * });
   * // => ['--apache-prefix=/opt/bitnami/apache']
   */
  populateFlagsFromDependencies(perDependencyFlags) {
    const list = [];
    _.each(perDependencyFlags, (data, id) => {
      if (_.isArray(data)) {
        data = {required: true, flags: data};
      } else if (_.isReallyObject(data)) {
        data = _.opts(data, {required: true, flags: []});
      } else {
        throw new Error('Flag format not reconigzed');
      }
      const obj = this.get(id);
      if (obj) {
        _.each(data.flags, function(flag) {
          list.push(nhb.renderText(flag, _.pick(obj, [
            'prefix', 'srcDir', 'libDir', 'binDir', 'headersDir', 'workingDir', 'licenseDir', 'extraFilesDir'
          ])));
        });
      } else {
        if (data.required) throw new Error(`${id} is required but has not been built`);
      }
    });
    return list;
  }

  /**
   * Get the build index of a component
   * @function Blacksmith.BuildManager.ComponentList~getIndex
   * @param {string} searchTerm - Term to search
   * @returns {number}
   * @example
   * getIndex('apache')
   * // => 3
   */
  getIndex(searchTerm) {
    return _.findIndex(this._components, c => c.id === searchTerm);
  }

  /**
   * Get the list of components to build using the format id@version
   * @function Blacksmith.BuildManager.ComponentList~getPrintableList
   * @returns {string}
   * @example
   * getPrintableList()
   * // => 'bzip2@1.0.6, openssl@1.0.1t, python@2.7.11'
   */
  getPrintableList() {
    return _.map(this._components, component => `${component.metadata.id}@${component.metadata.version}`).join(', ');
  }
}

module.exports = ComponentList;

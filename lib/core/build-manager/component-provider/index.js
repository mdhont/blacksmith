'use strict';

const _ = require('nami-utils/lodash-extra');
const Logger = require('nami-logger');
const RecipeLogicProvider = require('./recipe/logic-provider');
const RecipeMetadataProvider = require('./recipe/metadata-provider');

/**
 * Class representing the Component Provider
 * @namespace ComponentProvider
 * @class
 * @param {string|Array} recipeDirectories - Path to recipe folders
 * @param {Object} componentTypeCollections - Collection of component types to use
 * @param {Object} [options]
 * @param {Object} [options.metadataServer] - MetadataServer configuration
 * @param {boolean} [options.metadataServer.activate] - Use a metadata server
 * @param {boolean} [options.metadataServer.prioritize] - Prioritize the metadata server
 * @param {Object} [options.logger] - Logger to use
 */
class ComponentProvider {
  constructor(recipeDirectories, componentTypeCollections, options) {
    options = _.opts(options, {
      logger: null,
      metadataServer: {
        activate: false,
        prioritize: false,
        endPoint: null
      }
    });
    this.metadataServer = null;
    if (options.metadataServer.activate) {
      this.metadataServer = {
        client: this._getAnvilClient(options.metadataServer.endPoint),
        prioritize: options.metadataServer.prioritize
      };
    }
    this.recipeDirectories = _.toArrayIfNeeded(recipeDirectories);
    this.metadataProvider = new RecipeMetadataProvider(this.metadataServer, {
      logger: options.logger
    });
    this.logicProvider = new RecipeLogicProvider(this.recipeDirectories, componentTypeCollections, {
      logger: options.logger
    });
    this.logger = options.logger || new Logger({level: 'silent'});
  }

  _getAnvilClient(endPoint) {
    const AnvilClient = require('anvil-client'); // eslint-disable-line import/no-unresolved
    if (_.isEmpty(endPoint)) {
      throw new Error('To activate the metadata server you need to provide an end point URL');
    }
    return new AnvilClient(endPoint);
  }

  /**
   * Looks for a recipe and instatiate it to return a {@link Component}
   * @function ComponentProvider~getComponent
   * @param {Object|string} componentData - Component information
   * @param {Object} componentData.id - ID of the component
   * @param {Object} [componentData.version] - Default version of the component
   * @param {Object} [componentData.source] - Source tarball information
   * @param {Object} [componentData.source.tarball] - Default path to the component tarball
   * @param {Object} [componentData.source.sha256] - SHA256 of the tarball
   * @param {Object} [requirements] - Requirements for the component
   * @returns {@link Component}
   * @example
   * getComponent('zlib', {version: '~1.2'});
   */
  getComponent(componentData, requirements) {
    let componentId = null;
    let componentVersion = null;
    if (_.isString(componentData)) {
      componentId = componentData;
    } else if (_.isReallyObject(componentData) && !_.isUndefined(componentData.id)) {
      componentId = componentData.id;
      if (!_.isUndefined(componentData.version)) {
        componentVersion = componentData.version;
        requirements = _.opts(requirements, {version: componentVersion});
      }
    }
    const recipeDir = this.logicProvider.findRecipeFolder(componentId, this.recipeDirectories);
    const recipeMetadata = this.metadataProvider.getMetadata(componentId, {recipeDir, requirements});
    const RecipeClass = this.logicProvider.getRecipeClass(componentId, recipeDir, requirements);
    const component = new RecipeClass(recipeMetadata);
    component.id = component.id || componentId;
    _.extend(component, _.pick(componentData, ['source', 'patches', 'extraFiles']));
    return component;
  }
}

module.exports = ComponentProvider;

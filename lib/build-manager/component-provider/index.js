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
    this.metadataProvider = new RecipeMetadataProvider(this.recipeDirectories, options.metadataServer, {
      logger: options.logger
    });
    this.logicProvider = new RecipeLogicProvider(this.recipeDirectories, componentTypeCollections, {
      logger: options.logger
    });
    this.logger = options.logger || new Logger({level: 'silent'});
  }

  _getAnvilClient(endPoint) {
    const AnvilClient = require('anvil-client');
    if (_.isEmpty(endPoint)) {
      throw new Error('To activate the metadata server you need to provide an end point URL');
    }
    return new AnvilClient(endPoint);
  }

  /**
   * Parse a reference
   * @function Blacksmith.BuildManager.ComponentProvider~parseComponentReference
   * @param {string|Object} reference - Component reference. Can be a string or an object specifying its properties
   * @returns {Object} - Object defining parsed properties
   * @example
   * // Parse a string reference:
   * parseComponentReference('zlib');
   * // => {version: null, id: 'zlib', sourceTarball: null, patches: [], extraFiles: []}
   * @example
   * // Parse a string reference including version and tarball path:
   * parseComponentReference('zlib@1.2.3:/tmp/zlib-1.2.3.tar.gz');
   * // => {version: 1.2.3, id: 'zlib', sourceTarball: /tmp/zlib-1.2.3.tar.gz, patches: [], extraFiles: []}
   * @example
   * // Parse an object reference:
   * parseComponentReference({version: '5.5.21', tarball: '/tmp/php-5.5.21.tar.gz'}, patches: ['/tmp/php.patch']);
   * // => {
   *        version: '5.5.21', id: 'php',
   *        sourceTarball: '/tmp/php-5.5.21.tar.gz',
   *        patches: ['/tmp/php.patch'], extraFiles: []}
   */
  parseComponentReference(reference) {
    let id = null;
    let sourceTarball = null;
    let version = null;
    let patches = [];
    let extraFiles = [];
    if (_.isString(reference)) {
      const match = reference.match(/^([^@:]*)(@([^:]*))?(:(.*))?$/);
      id = match[1];
      if (!_.isEmpty(match[3])) version = match[3];
      if (!_.isEmpty(match[5])) sourceTarball = match[5];
    } else if (_.isObject(reference)) {
      sourceTarball = reference.sourceTarball || null;
      id = reference.id;
      version = reference.version;
      patches = reference.patches || [];
      extraFiles = reference.extraFiles || [];
    } else {
      throw new Error(`Don't know how to parse component reference ${JSON.stringify(reference)}`);
    }
    if (_.isEmpty(sourceTarball)) {
      this.logger.warn(`You should specify a sourceTarball for ${id}. ` +
        `F.e. ${id}@version:/path/to/${id}.tar.gz or specify it in the JSON input`);
    }
    return {version, id, sourceTarball, patches, extraFiles};
  }

  /**
   * Looks for a recipe and instatiate it to return a {@link Component}
   * @function ComponentProvider~getComponent
   * @param {Object|string} componentData - Component information
   * @param {Object} componentData.id - ID of the component
   * @param {Object} [componentData.version] - Default version of the component
   * @param {Object} [componentData.sourceTarball] - Default path to the component tarball
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
    _.extend(component, _.pick(componentData, ['sourceTarball', 'patches', 'extraFiles']));
    return component;
  }
}

module.exports = ComponentProvider;

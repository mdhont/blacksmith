'use strict';

const _ = require('nami-utils/lodash-extra');
const Logger = require('nami-logger');
const RecipeLogicProvider = require('./recipe/logic-provider');
const semver = require('semver');
const versionUtils = require('version-utils');

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
    });
    this.recipeDirectories = _.toArrayIfNeeded(recipeDirectories);
    this.logicProvider = new RecipeLogicProvider(this.recipeDirectories, componentTypeCollections, {
      logger: options.logger
    });
    this.logger = options.logger || new Logger({level: 'silent'});
  }


  /**
   * Looks for a recipe and instatiate it to return a {@link Component}
   * @function ComponentProvider~getComponent
   * @param {Object|string} componentData - Component information
   * @param {Object} componentData.id - ID of the component
   * @param {Object} componentData.version - Default version of the component
   * @param {Object} componentData.source - Source tarball information
   * @param {Object} componentData.source.tarball - Default path to the component tarball
   * @param {Object} componentData.source.sha256 - SHA256 of the tarball
   * @param {Object} [requirements] - Requirements for the component
   * @returns {@link Component}
   * @example
   * getComponent('zlib', {version: '~1.2'});
   */
  getComponent(componentData, requirements) {
    requirements = _.opts(requirements, {version: componentData.version});
    if (!semver.satisfies(versionUtils.getSemanticVersion(componentData.version), requirements.version)) {
      throw new Error(`Current component ${JSON.stringify(componentData)} does not satisfies ${requirements.version}`);
    }
    const RecipeClass = this.logicProvider.getRecipeClass(
      componentData.recipeLogicPath,
      requirements
    );
    const component = new RecipeClass(
      componentData.id,
      componentData.version,
      componentData.source,
      componentData.metadata,
      {
        patches: componentData.patches,
        extraFiles: componentData.extraFiles,
      }
    );
    return component;
  }
}

module.exports = ComponentProvider;

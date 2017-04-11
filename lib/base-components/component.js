'use strict';
const path = require('path');
const _ = require('nami-utils/lodash-extra');
const Logger = require('nami-logger');
const delegate = require('nami-utils').delegate;
const ncrypt = require('nami-utils/crypto');
const nfile = require('nami-utils').file;
const tarballUtils = require('tarball-utils');
const cutils = require('compilation-utils');

/**
 * Class representing a Component
 * @namespace BaseComponents.Component
 * @class
 * @param {Object} metadata - {@link Recipe} metadata
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger to use
 * @property {Array} patches - Patch files to apply
 * @property {number} patchLevel - Patch level to use in the patches applied
 * @property {Array} extraFiles - Additional files to copy in the working directory
 * @property {Array} pick - Files to exclusively pick in the resulting artifact. All the installed files by default.
 * @property {Array} exclude=['.git', '.__empty_dir'] - Files to exclude in the resulting artifact
 * @property {Object} be - {@link Blacksmith.BuildEnvironment Build Environment} to use
 * @property {Object} logger - Logger to use
 * @property {Object} metadata - Metadata of the componentList
 * @property {Object} source
 * @property {string} source.tarball - Path to the tarball of the component
 * @property {string} source.sha256 - SHA256 of the tarball
 * @property {string} version - Current version
 */
class Component {
  constructor(metadata, options) {
    options = _.options(options, {logger: null});
    this.patches = [];
    this.patchLevel = 0;
    this.extraFiles = [];
    this.pick = [];
    this.exclude = ['.git', '.__empty_dir'];
    this.be = null;
    this.logger = options.logger || new Logger();
    this.metadata = _.opts(metadata, {id: null, licenses: [], version: null});
    this.source = {};
    this.mainLicense = {};
    this.version = null;
  }
  /**
  * Get build prefix
  * @returns {mixed}
  */
  get prefix() {
    return path.join(this.be.prefixDir, this.metadata.id);
  }
  /**
  * Get build srcDir
  * @returns {mixed}
  */
  get srcDir() {
    return path.join(this.be.sandboxDir, `${(this.id || this.metadata.id).toLowerCase()}-${this.metadata.version}`);
  }
  /**
  * Get build workingDir
  * @returns {mixed}
  */
  get workingDir() {
    return this.srcDir;
  }
  /**
  * Get build licenseDir
  * @returns {mixed}
  */
  get licenseDir() {
    return path.join(this.prefix, 'licenses');
  }
  /**
  * Get build extraFilesDir
  * @returns {mixed}
  */
  get extraFilesDir() {
    return path.join(this.workingDir, 'extra-files');
  }
  /**
   * Setup the Component environment
   * @function BaseComponents.Component~setup
   * @param {Object} be - {@link Blacksmith.BuildEnvironment}
   * @param {Object} [options]
   * @param {Object} [options.logger] - Logger to use
   */
  setup(componentList, options) {
    this.be = componentList.be;
    this.componentList = componentList;
    options = _.opts(options, {logger: null});
    this.logger = options.logger || this.logger || new Logger();
    // Convenience methods for easier access
    delegate(this, ['info', 'error', 'warn', 'trace'], this.logger);
  }
  /**
   * Validate the component metadata
   * @function BaseComponents.Component~validate
   */
  validate() {
    if (_.isEmpty(this.metadata)) throw new Error('You must configure some software product to build');
    const errors = [];
    _.each(['id', 'version', 'licenses'], key => {
      if (_.isEmpty(this.metadata[key])) errors.push(`You must provide a proper '${key}' for you component`);
    });
    if (!_.isEmpty(errors)) {
      throw new Error(`Some errors were found validating ${this.metadata.id} ` +
        `formula:\n ${errors.join('\n')}`);
    }
  }
  /**
   * Copy component extra files in extraFilesDir
   * @function BaseComponents.Component~copyExtraFiles
   */
  copyExtraFiles() {
    if (this.extraFiles.length > 0) {
      nfile.mkdir(this.extraFilesDir);
      _.each(this.extraFiles, f => {
        if (_.isEmpty(f)) throw new Error(`Wrong extraFiles defintion. Found ${f} instead of a file path`);
        if (!path.isAbsolute(f)) throw new Error(`Path to extraFiles should be absolute. Found ${f}`);
        nfile.copy(f, this.extraFilesDir);
      });
    }
  }
  _getCmdOpts(options) {
    return _.opts(options, {logger: this.logger});
  }
  /**
   * Apply component patches
   * @function BaseComponents.Component~patch
   */
   /**
   * Applies a patch
   * @function BaseComponents.CompilableComponent~patch
   * @param {string} patchFile - Path to the patch to apply
   * @param {Object} [options] - Additional options to pass to runProgram method
   * @param {number} [options.patchLevel] - Patch level to apply
   * @param {string} [options.cwd=srcDir] - Working directory
   * @returns - LogExec output
   */
  patch() {
    _.each(this.patches, p => {
      if (_.isEmpty(p)) throw new Error(`Wrong patches defintion. Found ${p} instead of a file path`);
      if (!path.isAbsolute(p)) throw new Error(`Path to patches should be absolute. Found ${p}`);
      this.logger.trace(`Applying patch ${p}`);
      cutils.patch(this.srcDir, p, this._getCmdOpts({patchLevel: this.patchLevel || 0}));
    });
  }
  /**
   * Check component license(s) and place them in the a folder inside the component prefix
   * @function BaseComponents.Component~fulfillLicenseRequirements
   */
  fulfillLicenseRequirements() {
    if (!_.isEmpty(this.metadata.licenses)) {
      if (this.metadata.licenses.length > 1) {
        if (_.filter(this.metadata.licenses, 'main', true).length !== 1) {
          throw new Error(`You should define a main license between ${_.pluck(this.metadata.licenses, 'type')}`);
        }
        this.mainLicense = _.filter(this.metadata.licenses, 'main', true)[0];
      } else if (this.metadata.licenses.length === 1) {
        this.mainLicense = this.metadata.licenses[0];
      }
      const destinationLicenseFile = path.join(this.licenseDir, `${this.metadata.id}-${this.metadata.version}.txt`);
      nfile.mkdir(this.licenseDir);
      if (this.mainLicense.licenseRelativePath) {
        const srcLicenseFile = path.join(this.srcDir, this.mainLicense.licenseRelativePath);
        if (!nfile.exists(srcLicenseFile)) {
          throw new Error(`License file '${srcLicenseFile}' does not exist`);
        }
        nfile.copy(srcLicenseFile, destinationLicenseFile);
      } else if (this.mainLicense.licenseUrl) {
        nfile.write(destinationLicenseFile, `${this.mainLicense.type}: ${this.mainLicense.licenseUrl}`);
      } else {
        if (this.mainLicense.type === 'CUSTOM') {
          nfile.write(destinationLicenseFile, `Distributed under ${this.mainLicense.type} license`);
        } else {
          throw new Error(`You should specify either a licenseRelativePath or a licenseUrl for a CUSTOM license`);
        }
      }
    } else {
      this.logger.debug(`Skipping license propagation. There is no license information available for ${this.id}`);
    }
  }
  /**
   * Extract component tarball in srcDir
   * @function BaseComponents.Component~extract
   */
  extract() {
    if (_.isEmpty(this.source.tarball)) {
      throw new Error(`The source tarball is missing. Received ${this.source.tarball}`);
    }
    if (!path.isAbsolute(this.source.tarball)) {
      throw new Error(`Path to source tarball should be absolute. Found ${this.source.tarball}`);
    }
    const checksum = ncrypt.sha256({file: this.source.tarball});
    if (checksum !== this.source.sha256) {
      throw new Error(
        `Calculated SHA256 of ${this.source.tarball} (${checksum}) ` +
        `doesn't match the given one (${this.source.sha256})`
      );
    }
    tarballUtils.unpack(this.source.tarball, this.srcDir, {reRoot: true});
  }
  /**
   * After extract hook. No action will be taken by default.
   * @function BaseComponents.Component~postExtract
   */
  postExtract() {}
  /**
   * Delete srcDir
   * @function BaseComponents.Component~cleanup
   */
  cleanup() {
    this.logger.trace(`Deleting ${this.srcDir}`);
    nfile.delete(this.srcDir);
  }
  /**
   * Build hook. No action will be taken by default.
   * @function BaseComponents.Component~build
   */
  build() {}
  /**
   * Post build hook. No action will be taken by default.
   * @function BaseComponents.Component~postBuild
   */
  postBuild() {}
  /**
   * Install hook. No action will be taken by default.
   * @function BaseComponents.Component~install
   */
  install() {}
  /**
   * Post install hook. No action will be taken by default.
   * @function BaseComponents.Component~postInstall
   */
  postInstall() {}
  /**
   * Post install clean up hook. No action will be taken by default.
   * @function BaseComponents.Component~minify
   */
  minify() {}
  /**
   * Hook to initialize component properties. No action will be taken by default.
   * @function BaseComponents.Component~initialize
   */
  initialize() {}
  /**
   * Environment variables to export. None by default.
   * @function BaseComponents.Component~getExportableEnvironmentVariables
   * @returns {Object} Key/value defining the variable name and the value of it
   */
  getExportableEnvironmentVariables() {
    return {};
  }
}
module.exports = Component;

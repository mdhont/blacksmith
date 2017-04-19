'use strict';

const _ = require('nami-utils/lodash-extra');
const docker = require('docker-utils');
const ImageProvider = require('./image-provider');
const nfile = require('nami-utils').file;
const nos = require('nami-utils').os;
const strftime = require('strftime');

/**
 * Class representing the Containerized Builder
 * @namespace Blacksmith.ContainerizedBuilder
 * @class
 * @param {Object} blacksmithInstance - {@link Blacksmith} instance to use
 * @property {Object} config - Blacksmith {@link ConfigurationHandler Configuration}
 * @property {Object} blacksmithInstance - {@link Blacksmith} instance to use
 * @property {Object} logger - Logger
 */
class ContainerizedBuilder {

  constructor(blacksmithInstance) {
    this.config = blacksmithInstance.config;
    this.blacksmithInstance = blacksmithInstance;
    this.logger = blacksmithInstance.logger;
  }

  _getBuildDependencies(components) {
    return _.flatten(_.map(components, component => {
      return _.get(this.blacksmithInstance.bm.componentProvider.getComponent(component), 'buildDependencies', []);
    }));
  }

  _getImage(buildDependencies, baseImages, platform, buildDir) {
    const imageProvider = new ImageProvider(
      baseImages,
      {logger: this.logger}
    );
    const imageID = imageProvider.getImage(
      buildDependencies,
      platform,
      {buildDir}
    );
    return imageID;
  }

  _cleanUpContainerPrefix(paths) {
    if (!_.isUndefined(paths.prefix) &&
       !nfile.isEmptyDir(paths.prefix.hostPath)) {
      nfile.delete(paths.prefix.hostPath);
      nfile.mkdir(paths.prefix.hostPath);
    }
  }

  _writeConf(paths, prefix, imageId) {
    nfile.write(nfile.join(paths.config.hostPath, 'config.json'), JSON.stringify({
      logging: {
        logFile: nfile.join(paths.logs.containerPath, 'build.log'),
        logLevel: this.config.get('logging.logLevel')
      }, paths: {
        output: '/opt/blacksmith/output',
        sandbox: paths.sandbox.containerPath,
      }, compilation: {
        prefix,
        maxJobs: this.config.get('compilation.maxJobs')
      },
      containerizedBuild: {
        images: [{
          id: imageId
        }]
      }
    }));
  }

  _getPaths(buildDir, containerRootDir) {
    const result = {
      buildDir: {
        hostPath: buildDir,
        containerPath: nfile.join('/opt/blacksmith/output', nfile.basename(buildDir))
      },
      blacksmithRoot: {
        hostPath: this.config.get('paths.rootDir'),
        containerPath: {path: '/blacksmith', mode: 'ro'}
      },
      config: {
        hostPath: nfile.join(buildDir, 'config'),
        containerPath: '/opt/blacksmith/config'
      },
      sandbox: {
        hostPath: nfile.join(containerRootDir, this.config.get('paths.sandbox')),
        containerPath: this.config.get('paths.sandbox')
      },
      tmp: {
        hostPath: nfile.join(containerRootDir, '/tmp'),
        containerPath: '/tmp'
      },
      logs: {
        hostPath: nfile.join(buildDir, 'logs'),
        containerPath: '/tmp/logs'
      }
    };
    // Normalize paths in order to be able to mount them
    _.each(_.keys(result), path => {
      result[path].hostPath = nfile.normalize(result[path].hostPath);
      result[path].containerPath = _.isString(result[path].containerPath) ?
      nfile.normalize(result[path].containerPath) :
      nfile.normalize(result[path].containerPath.path)
      ;
    });
    return result;
  }

  _prepareMappings(paths) {
    const result = {};
    _.each(paths, (path) => {
      result[path.hostPath] = path.containerPath;
      nfile.mkdir(path.hostPath);
    });
    return result;
  }

  _generateCmd(buildData, paths, prefix, options) {
    const cmd = ['/blacksmith/bin/blacksmith'];
    cmd.push('--config', nfile.join(paths.config.containerPath, 'config.json'), 'build');
    if (options.buildId) {
      cmd.push('--build-id', options.buildId);
    }
    cmd.push('--build-dir', paths.buildDir.containerPath);
    if (options.incrementalTracking) {
      cmd.push('--incremental-tracking');
    }
    if (options.continueAt) {
      cmd.push(`--continue-at=${options.continueAt}`);
    }
    const buildFile = 'containerized-build.json';
    nfile.write(nfile.join(paths.config.hostPath, buildFile), JSON.stringify(buildData, null, 4));
    cmd.push(nfile.join(paths.config.containerPath, buildFile));
    if (!nos.runningAsRoot()) {
      // Allow the current user to modify the result changing the owner
      // of the generated files
      const script = nfile.join(paths.tmp.hostPath, 'scripts/run.sh');
      nfile.write(script, `#!/bin/bash
  ${cmd.join(' ')}
  res=$?
  chown -R ${process.geteuid(process.geteuid())}:${process.getgid()} ${paths.buildDir.containerPath} ${prefix}
  exit $res`);
      nfile.chmod(script, '755');
      return nfile.join(paths.tmp.containerPath, 'scripts/run.sh');
    } else {
      return cmd;
    }
  }

  /**
   * Copies a file to a new root folder returning the file path from the new root
   * @private
   * @param {string} newRoot - Future root directory
   * @param {string} sourceFile - File to copy
   * @param {string} innerDirectory - Absoulte path to an internal directory inside the new root
   * @returns {string} - Path to the file from the new root
   * @example
   * _copyToRoot('/container/root', '/tmp/a', '/tmp/my-dir')
   * // => /tmp/my-dir/a
   */
  _copyToRoot(newRoot, sourceFile, innerDirectory) {
    const hostDir = nfile.join(newRoot, innerDirectory);
    if (!nfile.exists(hostDir)) nfile.mkdir(hostDir);
    nfile.copy(sourceFile, nfile.join(newRoot, innerDirectory));
    return nfile.join(innerDirectory, nfile.basename(sourceFile));
  }

  /**
   * Build using a container as environment
   * @function Blacksmith.ContainerizedBuilder~build
   * @param {string} [imageId] - Docker Image to use
   * @param {Array|Object} [buildData] - Array or object with the components to build
   * @param {Object} [options]
   * @param {string} [options.forceRebuild=false] - Force build from the beggining
   * @param {string} [options.containerRoot=null] - Directory to use as root for the container
   * @param {string} [options.continueAt=null] - Continue a previous installation from a specific container
   * @param {boolean} [options.incrementalTracking=false] - Use incremental tracking function of blacksmith
   * @param {Object} [options.logger=null] - Logger to use
   * @example
   * build({components: [{id: 'zlib', source: {tarball: '/path/to/zlib.tar.gz'}]}, 'my-docker-image');
   */
  build(buildData, baseImages, options) {
    options = _.opts(options, {
      forceRebuild: false,
      containerRoot: null,
      continueAt: null,
      incrementalTracking: false,
      logger: null});

    // Validation of parameters
    if (options.forceRebuild && !_.isEmpty(options.continueAt)) {
      throw new Error('You cannot use --force-rebuild and --continue-at in the same build');
    }
    if (_.isEmpty(baseImages)) throw new Error('You should specify at least a base image');

    // Resolves build directory
    let buildDir = null;
    if (options.buildDir) {
      buildDir = nfile.normalize(options.buildDir);
    } else {
      const output = nfile.normalize(this.config.get('paths.output'));
      // Get the ID from the last component to build
      const lastComponent = _.last(this.blacksmithInstance.bm.getComponentsMetadata(buildData).components);
      const buildTail = `${strftime('%F-%H%M%S')}-${lastComponent.id}-stack`;
      buildDir = nfile.join(output, buildTail);
    }

    // Obtain base imageID
    const buildDependencies = this._getBuildDependencies(buildData.components);
    const imageID = this._getImage(buildDependencies, baseImages, buildData.platform, buildDir);

    // Initializing required vars
    const shouldCleanUpContainerPrefix = options.forceRebuild && (
      !_.isEmpty(options.buildDir) || !_.isEmpty(options.containerRoot)
    );
    const containerRootDir = options.containerRoot || nfile.join(buildDir, 'root');
    if (!nfile.exists(containerRootDir)) nfile.mkdir(containerRootDir);
    const prefix = this.config.get('compilation.prefix');
    const pathsToMap = this._getPaths(buildDir, containerRootDir);
    // Add 'prefix' to pathsToMap only if it already exists and the rebuild is not forced
    if (nfile.exists(nfile.join(containerRootDir, prefix)) && !shouldCleanUpContainerPrefix) {
      pathsToMap.prefix = {hostPath: nfile.join(containerRootDir, prefix), containerPath: prefix};
    } else {
      nfile.mkdir(nfile.join(containerRootDir, prefix));
      if (shouldCleanUpContainerPrefix) this._cleanUpContainerPrefix(pathsToMap);
    }
    const mappings = this._prepareMappings(pathsToMap);
    const logFile = nfile.join(pathsToMap.logs.hostPath, 'build.log');

    this.logger.debug('Preparing container directories and files');
    _.each(buildData.components, component => {
      component.source.tarball = this._copyToRoot(
        containerRootDir,
        component.source.tarball,
        `/tmp/sources/${component.id}/`
      );
      component.recipeLogicPath = this._copyToRoot(
        containerRootDir,
        component.recipeLogicPath,
        `/tmp/recipes/${component.id}/`
      );
      _.each(['extraFiles', 'patches'], fileList => {
        _.each(component[fileList], file => {
          file.path = this._copyToRoot(
            containerRootDir,
            file.path,
            `/tmp/sources/${component.id}/`
          );
        });
      });
    });

    // Initialize Blacksmith build environment with log and artifacts directories
    this.blacksmithInstance.bm.createBuildEnvironment({
      prefixDir: null, sandboxDir: null,
      platform: buildData.platform,
      outputDir: buildDir,
      logsDir: pathsToMap.logs.hostPath,
      artifactsDir: nfile.join(buildDir, 'artifacts')
    });

    this.logger.debug('Writing container configuration');
    this._writeConf(pathsToMap, prefix, imageID);

    this.logger.info(`Running build inside docker image ${imageID}`);
    this.logger.info(`You can find the full build log under ${logFile}`);
    docker.runInContainerAsync(
      imageID,
      this._generateCmd(buildData, pathsToMap, prefix, options),
      (container, result) => {
        if (_.isUndefined(pathsToMap.prefix)) {
          // Copy internal prefix dir if it is not mounted
          docker.exec(['cp', `${container.id}:${prefix}`, nfile.join(containerRootDir, nfile.dirname(prefix))]);
        }
        if (result.exitCode !== 0) {
          this.blacksmithInstance.exitCode = result ? result.exitCode : 1;
          this.logger.error(`The process failed: StatusCode=${result.exitCode}\n\n` +
            `You can review the installation log under ${logFile} ` +
            `as well as other temporary files under ${containerRootDir}`);
        } else {
          this.logger.info(`Command successfully executed. Find its results under ${buildDir}`);
          try {
            nfile.link(buildDir, nfile.join(nfile.dirname(buildDir), 'latest'), {force: true});
          } catch (e) {
            this.logger.debug('Unable to create symbolic link: ', e.message);
          }
          _.each(['logs', 'artifacts', 'config'], dir => {
            this.logger.info(`${dir}: ${nfile.join(buildDir, dir)}`);
          });
        }
      },
      {
        mappings, logger: this.logger, exitOnEnd: options.exitOnEnd // Allow to keep execution for test purposes
      }
    );
  }

  /**
   * Opens a shell using a previous build environment
   * @function Blacksmith.ContainerizedBuilder~dockerShell
   * @param {string} imageId - Container image id
   * @param {Object} [options]
   * @param {string} [options.root] - Path to overlay with the container root directory
   * @param {string} [options.buildDir] - Path to previous build output
   * @example
   * dockerShell('centos', {buildDir: '/blacksmith-output/test'});
   */
  dockerShell(buildDir, imageId, options) {
    options = _.opts(options, {containerRoot: null, imageId: null, buildData: null});
    this.logger.info('Preparing shell environment');
    let mappings = {blacksmithRoot: '/blacksmith:ro'};
    options.containerRoot = options.containerRoot || nfile.join(buildDir, 'root');
    const paths = this._getPaths(buildDir, options.containerRoot);
    const prefix = this.config.get('compilation.prefix');
    if (nfile.exists(nfile.join(options.containerRoot, prefix))) {
      paths.prefix = {hostPath: nfile.join(options.containerRoot, prefix), containerPath: prefix};
    }
    mappings = this._prepareMappings(paths);
    docker.shell(imageId, {
      root: options.containerRoot,
      mappings,
      runOptions: {
        name: `blacksmith-shell-${strftime('%F-%H%M%S')}`
      }
    });
  }
}

module.exports = ContainerizedBuilder;

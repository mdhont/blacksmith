'use strict';

const _ = require('nami-utils/lodash-extra');
const docker = require('docker-utils');
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
        logs: paths.logs.containerPath,
        sandbox: paths.sandbox.containerPath,
        recipes: this.config.get('paths.recipes')
      }, compilation: {
        prefix,
        maxJobs: this.config.get('compilation.maxJobs')
      },
      metadataServer: this.config.get('metadataServer'),
      containerizedBuild: {
        images: [{
          id: imageId
        }]
      }
    }));
  }

  _getPaths(buildDir, containerRootDir, recipesDir) {
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
    let cont = 1;
    _.each(_.flatten([recipesDir]), recipeDir => {
      result[`recipeDir${cont++}`] = {hostPath: recipeDir, containerPath: {path: recipeDir, mode: 'ro'}};
    });
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
    nfile.write(nfile.join(paths.config.hostPath, 'components.json'), JSON.stringify(buildData, null, 4));
    cmd.push('--json', nfile.join(paths.config.containerPath, 'components.json'));
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

  _prepareBuildData(buildData, sourcesPath) {
    const result = _.cloneDeep(buildData);
    result.components = [];
    const replacePath = (pathToReplace) => {
      nfile.copy(pathToReplace, sourcesPath.host);
      return nfile.join(sourcesPath.container, nfile.basename(pathToReplace));
    };
    _.each(buildData.components, component => {
      if (!_.isReallyObject(component)) {
        component = this.blacksmithInstance.bm.componentProvider.parseComponentReference(component);
      }
      const componentResult = _.cloneDeep(component);
      if (!_.isEmpty(component.sourceTarball)) {
        componentResult.sourceTarball = replacePath(component.sourceTarball);
      }
      _.each(['patches', 'extraFiles'], files => {
        componentResult[files] = [];
        _.each(component[files], file => componentResult[files].push(replacePath(file)));
      });
      result.components.push(componentResult);
    });
    return result;
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
   * build(['zlib:/path/to/zlib.tar.gz', 'openssl:/path/to/openssl.tar.gz']);
   */
  build(buildData, imageId, options) {
    options = _.opts(options, {
      forceRebuild: false,
      containerRoot: null,
      continueAt: null,
      incrementalTracking: false,
      logger: null});
    if (options.forceRebuild && !_.isEmpty(options.continueAt)) {
      throw new Error('You cannot use --force-rebuild and --continue-at in the same build');
    }
    if (_.isEmpty(imageId)) throw new Error('You should specify an imageID');
    // Initializing required vars
    const shouldCleanUpContainerPrefix = options.forceRebuild && (
      !_.isEmpty(options.buildDir) || !_.isEmpty(options.containerRoot)
    );
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
    const containerRootDir = options.containerRoot || nfile.join(buildDir, 'root');
    const sourcesDir = {
      container: '/tmp/sources',
      host: nfile.join(containerRootDir, '/tmp/sources')
    };
    const prefix = this.config.get('compilation.prefix');
    const recipesDir = this.config.get('paths.recipes');
    const pathsToMap = this._getPaths(buildDir, containerRootDir, recipesDir);
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
    nfile.mkdir(containerRootDir);
    nfile.mkdir(sourcesDir.host);
    const parsedBuildData = this._prepareBuildData(buildData, sourcesDir);
    const cmd = this._generateCmd(parsedBuildData, pathsToMap, prefix, options);
    this.blacksmithInstance.bm.createBuildEnvironment({
      sourcePaths: null, prefixDir: null, sandboxDir: null,
      platform: buildData.platform,
      outputDir: buildDir,
      logsDir: pathsToMap.logs.hostPath,
      artifactsDir: nfile.join(buildDir, 'artifacts')
    });

    this.logger.debug('Writing container configuration');
    this._writeConf(pathsToMap, prefix, imageId);

    this.logger.info(`Running build inside docker image ${imageId}`);
    this.logger.info(`You can find the full build log under ${logFile}`);
    docker.runInContainerAsync(imageId, cmd, (container, result) => {
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
    }, {
      mappings, logger: this.logger, runOptions: {
        env: 'NODE_TLS_REJECT_UNAUTHORIZED=0' // Allow self-signed certificates
      }, exitOnEnd: options.exitOnEnd // Allow to keep execution for test purposes
    });
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
    const paths = this._getPaths(buildDir, options.containerRoot, this.config.get('paths.recipes'));
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

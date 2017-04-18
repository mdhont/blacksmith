'use strict';

const _ = require('nami-utils/lodash-extra');
const nfile = require('nami-utils').file;
const nos = require('nami-utils').os;
const Logger = require('nami-logger');

/**
 * Interface representing a Linux Distribution
 * @namespace Blacksmith.Distro
 * @class
 * @param {string} arch - Architecture of the distro
 * @param {Object} [options]
 * @param {Object} [options.logger] - Logger
 * @property {Object} logger - Logger
 */
class Distro {
  constructor(arch, options) {
    options = options || {};
    this.logger = options.logger || new Logger({
      prefix: 'image-provider',
      prefixColor: 'magenta',
      level: 'info',
    });
    this._arch = arch;
    this._packageManagementTool = null;
    this._pkgProviderCommand = null;
  }

  /**
  * Get the command to update the distro references
  * @returns {string}
  */
  get updateCommand() {
    return `${this._packageManagementTool} update -y`;
  }

  /**
  * Get the command to install a list of packages
  * @param {Array|string} pkgs - Packages to install
  * @returns {string}
  */
  installCommand() {
    throw new Error('This method should be implemented');
  }

  _getPkgNameFromDescriptor(descriptor) {                  // eslint-disable-line no-unused-vars
    throw new Error('This method should be implemented');
  }

  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _getBinaries(files) {
    return _.filter(files, file => {
      if (!nfile.isLink(file) && nfile.isBinary(file)) {
        // Support spaces and unscaped characters
        const fileArgument = `'${file}'`;
        const fileInfo = nos.runProgram('file', fileArgument);
        const extendedArch = this._arch === 'x64' ? '64-bit' : '32-bit';
        return fileInfo.match('dynamically linked') && fileInfo.match(extendedArch);
      } else {
        return false;
      }
    });
  }

  _parseLibrariesInfo(rawInfo) {
    const result = [];
    const entries = rawInfo.split('\n');
    _.each(entries, line => {
      // The lines including a library has the following format: ' => /path/to/library.so'
      if (line.match(' => /')) {
        const lib = line.match(/ => ([^\s]*)/)[1];
        result.push(lib);
      }
    });
    return _.uniq(result);
  }

  _filterLibraries(list, skipDirs) {
    skipDirs = skipDirs || [];
    return _.filter(list, lib => {
      return !_.some(skipDirs, dir => lib.startsWith(dir));
    });
  }

  _parsePkgsInfo(info) {
    const pkgDescriptorList = info.split('\n');
    const result = _.map(_.compact(pkgDescriptorList), desc => this._getPkgNameFromDescriptor(desc));
    return _.uniq(result);
  }

  /**
  * Return the runtime packages required to execute the binaries of a list of files
  * @param {Array} files - List of files to evaluate
  * @param {Object} [options]
  * @param {Array} [options.skipLibrariesIn] - Array of paths to skip the package resolution
  * @returns {Array}
  * @example
  * getRuntimePackages(['/bin/cat'])
  * // => ['libc6']
  */
  getRuntimePackages(files, options) {
    if (!nos.isInPath('file')) {
      throw new Error('Command "file" is needed to obtain runtime packages');
    }
    options = _.defaults(options || {}, {
      skipLibrariesIn: []
    });
    let runtimePackages = [];
    this.logger.trace('Getting files to evaluate');
    const binaries = this._getBinaries(files);
    if (!_.isEmpty(binaries)) {
      this.logger.debug('Getting information about linked libraries');
      const linksInfo = nos.runProgram('ldd', binaries, {
        retrieveStdStreams: true
      });
      if (!_.isEmpty(linksInfo.stderr)) {
        throw new Error(linksInfo.stderr);
      }
      const libraryList = this._parseLibrariesInfo(linksInfo.stdout);
      const librariesToEvaluate = this._filterLibraries(libraryList, options.skipLibrariesIn);
      if (!_.isEmpty(librariesToEvaluate)) {
        this.logger.debug('Getting information about runtime packages required');
        // The CMD to run may contain several options: for example `dpkg -S` so we need to split them
        const parsedCMD = _.flatten([this._pkgProviderCommand]);
        const command = parsedCMD[0];
        const args = parsedCMD.slice(1);
        const requiredPackagesInfo = nos.runProgram(command, args.concat(librariesToEvaluate));
        runtimePackages = this._parsePkgsInfo(requiredPackagesInfo);
      }
    }
    return runtimePackages;
  }
}

module.exports = Distro;

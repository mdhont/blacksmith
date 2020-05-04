'use strict';

const _ = require('nami-utils/lodash-extra');
const nfile = require('nami-utils').file;
const nos = require('nami-utils').os;
const Logger = require('nami-logger');
const fs = require('fs');

class UnimplementedMethodError extends Error {
  constructor(message) {
    if (!message) message = 'This method should be implemented';
    super(message);
  }
}

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
    throw new UnimplementedMethodError();
  }

  /**
  * Get the list of packages installed in the current distro. Each element will contain its name and version
  * @returns {Array}
  */
  listPackages() {
    throw new UnimplementedMethodError();
  }

  _getPkgNameFromDescriptor(descriptor) {                  // eslint-disable-line no-unused-vars
    throw new UnimplementedMethodError();
  }

  _escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  _getBinaryInfo(binary) {
    let result = '';
    let infoCommand;
    let infoCommandArgs;
    if (nos.isInPath('readelf')) {
      infoCommand = 'readelf';
      infoCommandArgs = ['--file-header', '--dynamic', binary];
    } else if (nos.isInPath('objdump')) {
      infoCommand = 'objdump';
      infoCommandArgs = ['-p', binary];
    } else if (nos.isInPath('file')) {
      // In some cases, 'file' may misidentify a dynamically linked .so library as being statically linked
      this.logger.warn(
        `Could not find recommended tools 'readelf' or 'objdump' to identify dynamically linked binaries. Falling back `
        + `to less reliable 'file' tool.`
      );
      infoCommand = 'file';
      infoCommandArgs = [binary];
    } else {
      throw new Error(`Commands 'readelf', 'objdump' or 'file' are required to obtain runtime packages.`);
    }
    try {
      result = nos.runProgram(infoCommand, infoCommandArgs);
    } catch (e) {
      // Failed to parse the file as binary
    }
    return result;
  }

  _getBinaries(files) {
    return _.filter(files, file => {
      if (!nfile.isLink(file) && nfile.isBinary(file)) {
        const fileInfo = this._getBinaryInfo(file);
        const extendedArch = ['x64', 'amd64', 'x86_64'].includes(this._arch) ? /(64-bit|elf64)/i : /(32-bit|elf32)/i;
        return fileInfo.match(/(NEEDED|dynamically linked)/) && fileInfo.match(extendedArch);
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
        let lib = line.match(/ => ([^\s]*)/)[1];
        // If the library is a symlink, we use the realpath
        lib = nfile.isLink(lib) ? fs.realpathSync(lib) : lib;
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

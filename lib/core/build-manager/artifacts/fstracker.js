'use strict';

const _ = require('lodash');
const nos = require('nami-utils').os;
const nfile = require('nami-utils').file;
const path = require('path');
const tarballUtils = require('tarball-utils');

/**
 * Class representing the File System Tracking that allows to capture the differentail between build steps
 * @namespace Blacksmith.BuildManager.FileSystemTracker
 * @class
 * @param {string} directory - Directory to track
 */
class FileSystemTracker {
  constructor(directory) {
    if (!nos.isInPath('git')) throw new Error('Git binary not found. You need git in order to track changes');
    this._directory = directory;
    this._fileList = [];
  }

  /**
   * Init the tracking
   * @function Blacksmith.BuildManager.FileSystemTracker~init
   */
  init() {
    if (nfile.exists(nfile.join(this._directory, '.git'))) {
      this._add({addToList: false});
      this.commit('Started tracking');
    } else {
      nos.runProgram('git', 'init', {cwd: this._directory});
      this._add({addToList: false});
      nos.runProgram('git', ['config', 'user.email', 'dev@bitnami.com'], {cwd: this._directory});
      nos.runProgram('git', ['config', 'user.name', 'blacksmith'], {cwd: this._directory});
      this.commit('Initial commit');
    }
  }

  _add(options) {
    options = _.defaults({}, options, {addToList: true});
    if (options.addToList) {
      this._fileList = this._fileList.concat(this.diff());
    }
    nos.runProgram('git', ['add', '.'], {cwd: this._directory});
  }

  _populateEmptyDirs() {
    nfile.walkDir(this._directory, function(f) {
      if (nfile.isDirectory(f) && nfile.isEmptyDir(f)) {
        nfile.write(nfile.join(f, '.__empty_dir'));
      }
    });
  }

  /**
   * Get the list of files modified in this layer (not commited)
   * @function Blacksmith.BuildManager.FileSystemTracker~diff
   * @returns {Array} - List of files
   */
  diff() {
    this._populateEmptyDirs();
    let list = nos.runProgram('git', ['ls-files', '--modified', '--others', '.'], {cwd: this._directory}).split('\n');
    // Remove deleted files
    const deleted = nos.runProgram('git', ['ls-files', '--deleted', '.'], {cwd: this._directory}).split('\n');
    list = _.difference(list, deleted);
    // Absolutize
    list = _.map(list, f => nfile.join(this._directory, f));
    return list;
  }


  /**
   * Filter a list of files based on conditions
   * @function Blacksmith.BuildManager.FileSystemTracker.filterFiles
   * @param {Array} list - List of files to filter
   * @param {Object} [conditions]
   * @param {Array} [conditions.pick] - Files to pick exclusively. All by default.
   * If set the rest of parameters will be ignored
   * @param {Array} [conditions.exclude] - File patterns to exclude files from the list. Any by default.
   * @param {Array} [conditions.paths] - Root paths that files should be contained into. All by default.
   */
  static filterFiles(list, conditions) {
    conditions = _.defaults({}, conditions, {
      pick: [],
      exclude: [],
      paths: []
    });
    let result = [];
    if (!_.isEmpty(conditions.pick)) {
      result = _.filter(_.flatten([conditions.pick]), f => nfile.exists(f));
    } else {
      let filesToExclude = [];
      if (conditions.exclude) {
        filesToExclude = _.flatten(_.map(conditions.exclude, pattern => nfile.glob(pattern)));
      }
      const nonExcludedFiles = _.difference(list, filesToExclude);
      _.each(nonExcludedFiles, f => {
        let match = true;
        if (!_.isEmpty(conditions.paths)) {
          match = _.some(_.flatten([conditions.paths]), p => _.startsWith(f, p));
        }
        if (match && nfile.exists(f)) {
          result.push(f);
        }
      });
    }
    return result;
  }

  // Avoid to use as a list with every single file if the whole directory is included
  _reduceByDirectory(list, options) {
    options = _.defaults(options, {}, {
      unless: []
    });
    const result = [];
    _.each(list, f => {
      if (nfile.isFile(f)) {
        const dir = nfile.dirname(f);
        if (result.indexOf(dir) < 0) {
          // If all the files included in the directory are in the list we can just return the directory
          const allFilesAreIncluded = _.every(nfile.glob(nfile.join(dir, '*')), ff => {
            return list.indexOf(ff) >= 0;
          });
          // Unless the directory is explicity discarded
          const dirShouldBeAvoided = _.find(options.unless, d => d === dir);
          if (allFilesAreIncluded && !dirShouldBeAvoided) {
            result.push(dir);
          } else {
            result.push(f);
          }
        }
      } else {
        result.push(f);
      }
    });
    return result;
  }

  /**
   * Creates a tarball with the files modified
   * @function Blacksmith.BuildManager.FileSystemTracker.captureDelta
   * @param {string} file - Path to the file to store the compressed files
   * @param {Object} [options]
   * @param {boolean} [options.all=true] - Compress all registered files
   * @param {boolean} [options.prefix] - Directory to pick files from
   * @param {boolean} [options.pick=[]] - Pick just the files specified
   */
  captureDelta(file, options) {
    options = _.defaults({}, options, {all: false, pathsToInclude: [this._directory], pick: [], exclude: []});
    nfile.mkdir(nfile.dirname(file));
    const list = options.all ? this._fileList : this.diff();
    const filesToCapture = this.constructor.filterFiles(list, {
      paths: options.pathsToInclude,
      pick: options.pick,
      // If the path is relative match with any pattern inside the prefix (default 'tar' behaviour)
      exclude: _.map(_.flatten([options.exclude]), e => {
        if (path.isAbsolute(e)) {
          return e;
        } else {
          return _.flatten(_.map(options.pathsToInclude, p => nfile.join(p, '**', e)));
        }
      })
    });
    if (_.isEmpty(filesToCapture)) return null;
    // If the file list to compress is too big we reach the Node maximum size
    const reducedList = this._reduceByDirectory(filesToCapture, {unless: this._directory});
    tarballUtils.tar(reducedList, file, {cwd: this._directory});
    return file;
  }

  /**
   * Commit the current files status
   * @function Blacksmith.BuildManager.FileSystemTracker~commit
   * @param {string} msg - Message to use
   */
  commit(msg) {
    this._add();
    const res = nos.runProgram('git', ['commit', '-a', '-m', msg], {cwd: this._directory, retrieveStdStreams: true});

    if (res.code !== 0) {
      if (!res.stdout.match('nothing to commit')) throw new Error(`Failed to commit: \n${res.stderr}`);
      return null;
    }
    return res.stdout.trim();
  }
}

module.exports = FileSystemTracker;

'use strict';

const _ = require('nami-utils/lodash-extra');
const nos = require('nami-utils').os;
const nfile = require('nami-utils').file;
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
    options = _.opts(options, {addToList: true});
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
   * Creates a tarball with the files modified
   * @function Blacksmith.BuildManager.FileSystemTracker.captureDelta
   * @param {string} file - Path to the file to store the compressed files
   * @param {Object} [options]
   * @param {boolean} [options.all=true] - Compress all registered files
   * @param {boolean} [options.prefix] - Directory to pick files from
   * @param {boolean} [options.pick=[]] - Pick just the files specified
   */
  captureDelta(file, options) {
    options = _.opts(options, {all: false, prefix: this._directory, pick: []});
    nfile.mkdir(nfile.dirname(file));
    const list = options.all ? this._fileList : this.diff();
    let filesToCapture = [];
    if (!_.isEmpty(options.pick)) {
      filesToCapture = options.pick;
    } else {
      _.each(list, f => {
        if (_.any(_.flatten([options.prefix]), p => _.startsWith(f, p))
        && nfile.exists(f)) {
          // Avoid to put every single file if the whole directory is included
          if (nfile.isFile(f)) {
            const dir = nfile.dirname(f);
            if (filesToCapture.indexOf(dir) < 0) {
              if (_.every(nfile.glob(nfile.join(f, '*')), ff => list.indexOf(ff) > 0) && dir !== this._directory) {
                filesToCapture.push(dir);
              } else {
                filesToCapture.push(f);
              }
            }
          } else {
            filesToCapture.push(f);
          }
        }
      });
    }
    if (_.isEmpty(filesToCapture)) return null;
    tarballUtils.tar(filesToCapture, file, {cwd: this._directory, exclude: ['.git', '.__empty_dir']});
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

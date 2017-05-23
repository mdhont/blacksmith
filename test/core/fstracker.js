'use strict';

const FileSystemTracker = require('../../lib/core/build-manager/artifacts/fstracker');
const path = require('path');
const fs = require('fs');
const sinon = require('sinon');
const spawnSync = require('child_process').spawnSync;
const tarballUtils = require('tarball-utils');
const chai = require('chai');
const chaiFs = require('chai-fs');
const expect = chai.expect;
chai.use(chaiFs);

describe('FSTracker', () => {
  const testDir = '/tmp/blacksmith-test-env';
  beforeEach('prepare environment', () => {
    fs.mkdirSync(testDir);
  });
  afterEach('clean environment', () => {
    spawnSync('rm', ['-rf', testDir]);
  });
  it('creates an instance successfully', () => {
    const fstracker = new FileSystemTracker(testDir);
    expect(fstracker._directory).to.be.eql(testDir);
  });
  it('inits the tracking', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    expect(path.join(fstracker._directory, '.git')).to.be.a.directory; //eslint-disable-line
  });
  it('adds status including files to the tracked list', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'hello'), 'hello');
    fstracker._add();
    expect(spawnSync('git', ['status'], {cwd: testDir}).stdout.toString()).to.contain('new file:   hello');
    expect(fstracker._fileList).to.contain(path.join(testDir, 'hello'));
  });
  it('adds status without including files to the tracked list', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'hello'), 'hello');
    fstracker._add({addToList: false});
    expect(spawnSync('git', ['status'], {cwd: testDir}).stdout.toString()).to.contain('new file:   hello');
    expect(fstracker._fileList).to.not.contain(path.join(testDir, 'hello'));
  });
  it('shows differential', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'hello'), 'hello');
    const list = fstracker.diff();
    expect(list).to.contain(path.join(testDir, 'hello'));
  });
  it('captures delta of changes', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'hello'), 'hello');
    const tarball = '/tmp/blacksmith-test-env/delta.tar.gz';
    fstracker.captureDelta(tarball);
    expect(spawnSync('tar', ['-ztf', tarball]).stdout.toString()).to.contain('hello');
  });
  it('captures all files', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'hello'), 'hello');
    fstracker.commit();
    const tarball = '/tmp/blacksmith-test-env/delta.tar.gz';
    fstracker.captureDelta(tarball, {all: true});
    expect(spawnSync('tar', ['-ztf', tarball]).stdout.toString()).to.contain('hello');
  });
  it('captures empty folders', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.mkdirSync(path.join(testDir, 'hello_dir'));
    fstracker.commit();
    const tarball = '/tmp/blacksmith-test-env/delta.tar.gz';
    fstracker.captureDelta(tarball, {all: true});
    expect(spawnSync('tar', ['-ztf', tarball]).stdout.toString()).to.contain('hello_dir');
  });
  it('calls for compression using just the directory paths', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.mkdirSync(path.join(testDir, 'directory'));
    fs.writeFileSync(path.join(testDir, 'directory/hello'), 'hello');
    fs.writeFileSync(path.join(testDir, 'directory/hello2'), 'hello');
    fstracker.commit();
    const tarball = '/tmp/blacksmith-test-env/delta.tar.gz';
    let result = [];
    sinon.stub(tarballUtils, 'tar').callsFake(list => result = list);
    try {
      fstracker.captureDelta(tarball, {all: true});
    } catch (e) {
      tarballUtils.tar.restore();
      throw e;
    }
    tarballUtils.tar.restore();
    expect(result).to.be.eql([path.join(testDir, 'directory')]);
  });
  it('calls for compression using just the minimum number of directories', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'a'), 'hello');
    fs.mkdirSync(path.join(testDir, 'b'));
    fs.writeFileSync(path.join(testDir, 'b/c'), 'hello');
    fs.mkdirSync(path.join(testDir, 'b/d'));
    fs.writeFileSync(path.join(testDir, 'b/d/e'), 'hello');
    fstracker.commit();
    const tarball = '/tmp/blacksmith-test-env/delta.tar.gz';
    let result = [];
    sinon.stub(tarballUtils, 'tar').callsFake(list => result = list);
    try {
      fstracker.captureDelta(tarball, {all: true});
    } catch (e) {
      tarballUtils.tar.restore();
      throw e;
    }
    tarballUtils.tar.restore();
    expect(result).to.be.eql([path.join(testDir, 'b'), path.join(testDir, 'a')]);
  });
  it('calls for compression using just the minimum number of directories without missing files', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'a'), 'hello');
    fs.mkdirSync(path.join(testDir, 'b'));
    fs.writeFileSync(path.join(testDir, 'b/c'), 'hello');
    fs.writeFileSync(path.join(testDir, 'bb'), 'hello');
    fstracker.commit();
    const tarball = '/tmp/blacksmith-test-env/delta.tar.gz';
    let result = [];
    sinon.stub(tarballUtils, 'tar').callsFake(list => result = list);
    try {
      fstracker.captureDelta(tarball, {all: true});
    } catch (e) {
      tarballUtils.tar.restore();
      throw e;
    }
    tarballUtils.tar.restore();
    expect(result).to.be.eql([path.join(testDir, 'b'), path.join(testDir, 'a'), path.join(testDir, 'bb')]);
  });
  it('captures a selection of files', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'hello'), 'hello');
    fs.writeFileSync(path.join(testDir, 'hello2'), 'hello');
    fstracker.commit();
    const tarball = '/tmp/blacksmith-test-env/delta.tar.gz';
    fstracker.captureDelta(tarball, {pick: path.join(testDir, 'hello')});
    expect(spawnSync('tar', ['-ztf', tarball]).stdout.toString()).to.contain('hello');
    expect(spawnSync('tar', ['-ztf', tarball]).stdout.toString()).to.not.contain('hello2');
  });
  it('excludes a selection of files', () => {
    const fstracker = new FileSystemTracker(testDir);
    fstracker.init();
    fs.writeFileSync(path.join(testDir, 'hello'), 'hello');
    fs.writeFileSync(path.join(testDir, 'hello2'), 'hello');
    const tarball = '/tmp/blacksmith-test-env/delta.tar.gz';
    fstracker.captureDelta(tarball, {exclude: ['hello2']});
    expect(spawnSync('tar', ['-ztf', tarball]).stdout.toString()).to.contain('hello');
    expect(spawnSync('tar', ['-ztf', tarball]).stdout.toString()).to.not.contain('hello2');
  });
});

'use strict';

/* eslint-disable no-unused-expressions */
const _ = require('lodash');
const docker = require('docker-utils');
const expect = require('chai').expect;
const ImageProvider = require('../../../lib/containerized-builder/image-provider');
const nfile = require('nami-utils').file;
const nos = require('nami-utils').os;
const sinon = require('sinon');

describe('ImageProvider', () => {
  beforeEach(() => {
    sinon.stub(docker, 'build').callsFake((dir, id) => {
      return {code: 0, dir, id};
    });
    sinon.stub(docker, 'imageExists').callsFake(() => true);
  });
  afterEach(() => {
    docker.build.restore();
    docker.imageExists.restore();
  });
  it('returns an image', () => {
    const platform = {os: 'linux', distro: 'debian'};
    const baseImage = {
      id: 'base',
      platform,
      buildTools: []
    };
    const registryFile = nos.createTempFile();
    nfile.write(registryFile, '[]');
    const imageProvider = new ImageProvider([baseImage], {
      registryFile
    });
    expect(imageProvider.getImage([{id: 'zlib', type: 'system', distro: 'debian'}], platform)).to.match(
      /blacksmith-buildpack-.*/
    );
  });
  it('returns the same image after several executions', () => {
    const platform = {os: 'linux', distro: 'debian'};
    const baseImage = {
      id: 'base',
      platform,
      buildTools: []
    };
    const registryFile = nos.createTempFile();
    nfile.write(registryFile, '[]');
    const imageProvider = new ImageProvider([baseImage], {
      registryFile
    });
    const imageID = imageProvider.getImage([{id: 'zlib', type: 'system', distro: 'debian'}], platform);
    expect(
      imageProvider.getImage([{id: 'zlib', type: 'system', distro: 'debian'}], platform)
    ).to.be.eql(imageID);
  });
  it('throws an error if a requirement format is not valid', () => {
    const platform = {os: 'linux', distro: 'debian'};
    const baseImage = {
      id: 'base',
      platform,
      buildTools: []
    };
    const registryFile = nos.createTempFile();
    nfile.write(registryFile, '[]');
    const imageProvider = new ImageProvider([baseImage], {
      registryFile
    });
    expect(() => imageProvider.getImage([{id: 'ruby'}], platform)).to.throw(
      'You should specify at least an id and type for each build requirement'
    );
    expect(() => imageProvider.getImage([{id: 'ruby', type: 'nami'}], platform)).to.throw(
      'For build requirements with a custom type you need to specify the commands to install them'
    );
  });
  it('returns an unique ID', () => {
    const platform = {os: 'linux', distro: 'debian'};
    const baseImage = {
      id: 'base',
      platform,
      buildTools: []
    };
    const registryFile = nos.createTempFile();
    nfile.write(registryFile, '[]');
    const imageProvider = new ImageProvider([baseImage], {
      registryFile
    });
    const imageID = imageProvider.getImage([{id: 'zlib', type: 'system', distro: 'debian'}], platform);
    expect(
      imageProvider.getImage([{id: 'libssl', type: 'system', distro: 'debian'}], platform)
    ).to.not.be.eql(imageID);
  });
  it('returns an unique ID', () => {
    const platform = {os: 'linux', distro: 'debian'};
    const baseImage = {
      id: 'base',
      platform,
      buildTools: []
    };
    const registryFile = nos.createTempFile();
    nfile.write(registryFile, '[]');
    const imageProvider = new ImageProvider([baseImage], {
      registryFile
    });
    const imageID = imageProvider.getImage([{id: 'zlib', type: 'system', distro: 'debian'}], platform);
    expect(
      imageProvider.getImage([{id: 'libssl', type: 'system', distro: 'debian'}], platform)
    ).to.not.be.eql(imageID);
  });
  it('ignore system requirements that are not for the target distro', () => {
    const platform = {os: 'linux', distro: 'debian'};
    const baseImage = {
      id: 'base',
      platform,
      buildTools: []
    };
    const registryFile = nos.createTempFile();
    nfile.write(registryFile, '[]');
    const imageProvider = new ImageProvider([baseImage], {
      registryFile
    });
    const imageID = imageProvider.getImage([
      {id: 'zlib', type: 'system', distro: 'debian'},
      {id: 'glibc', type: 'system', distro: 'centos'},
      {id: 'install_pip', type: 'pip', installCommands: 'pip install wheel'},
      {id: 'install_pip_centos', type: 'pip', distro: 'centos', installCommands: 'pip install numpy'},
      {id: 'install_pip_debian', type: 'pip', distro: 'debian', installCommands: 'pip install Cython'},
    ], platform);
    expect(
      _.find(imageProvider.imageRegistry.images, {id: imageID}).buildTools
    ).to.be.eql([
      {id: 'zlib', type: 'system', distro: 'debian'},
      {id: 'install_pip', type: 'pip', installCommands: 'pip install wheel'},
      {id: 'install_pip_debian', type: 'pip', distro: 'debian', installCommands: 'pip install Cython'},
    ]);
  });
  it('ignore system requirements that are not for the target distro version', () => {
    const platform = {os: 'linux', distro: 'debian', version: 9};
    const baseImage = {
      id: 'base',
      platform,
      buildTools: []
    };
    const registryFile = nos.createTempFile();
    nfile.write(registryFile, '[]');
    const imageProvider = new ImageProvider([baseImage], {
      registryFile
    });
    const imageID = imageProvider.getImage([
      {id: 'zlib', type: 'system', distro: 'debian', version: 8},
      {id: 'glibc', type: 'system', distro: 'debian'},
      {id: 'install_pip', type: 'pip', installCommands: 'pip install wheel'},
      {id: 'install_pip_centos', type: 'pip', distro: 'centos', installCommands: 'pip install numpy'},
      {id: 'install_pip_debian', type: 'pip', distro: 'debian', installCommands: 'pip install Cython', version: 9},
    ], platform);
    expect(
      _.find(imageProvider.imageRegistry.images, {id: imageID}).buildTools
    ).to.be.eql([
      {id: 'glibc', type: 'system', distro: 'debian'},
      {id: 'install_pip', type: 'pip', installCommands: 'pip install wheel'},
      {id: 'install_pip_debian', type: 'pip', distro: 'debian', installCommands: 'pip install Cython', version: 9},
    ]);
  });  
});

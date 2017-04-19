'use strict';

/* eslint-disable no-unused-expressions */
const docker = require('docker-utils');
const expect = require('chai').expect;
const ImageRegistry = require('../../../lib/containerized-builder/image-provider/image-registry');
const nfile = require('nami-utils').file;
const nos = require('nami-utils').os;
const sinon = require('sinon');

describe('ImageRegistry', () => {
  it('reads images from an existing registry', () => {
    const registry = nos.createTempFile();
    const images = [{id: 'test'}];
    nfile.write(registry, JSON.stringify(images));
    const imageRegistry = new ImageRegistry(registry);
    expect(imageRegistry.images).to.be.eql(images);
  });
  it('adds an image to the registry', () => {
    const registry = nos.createTempFile();
    nfile.write(registry, '[]');
    const imageRegistry = new ImageRegistry(registry);
    const id = 'test';
    const tools = [{id: 'zlib'}];
    const platform = {os: 'linux'};
    imageRegistry.add(id, tools, platform);
    const expectedResult = [{
      id, buildTools: tools, platform
    }];
    expect(imageRegistry.images).to.be.eql(expectedResult);
    expect(JSON.parse(nfile.read(registry))).to.be.eql(expectedResult);
  });
  it('removes an image from the registry', () => {
    const registry = nos.createTempFile();
    const images = [{id: 'test'}];
    nfile.write(registry, JSON.stringify(images));
    const imageRegistry = new ImageRegistry(registry);
    imageRegistry.remove('test');
    expect(imageRegistry.images).to.be.eql([]);
    expect(JSON.parse(nfile.read(registry))).to.be.eql([]);
  });
  describe('#getImage', () => {
    beforeEach(() => {
      sinon.stub(docker, 'imageExists').callsFake(() => true);
    });
    afterEach(() => {
      docker.imageExists.restore();
    });
    it('returns an image satisfying some nami requirements', () => {
      const platform = {os: 'linux'};
      const registry = nos.createTempFile();
      const images = [{id: 'test', buildTools: [{id: 'ruby', type: 'nami'}], platform}];
      nfile.write(registry, JSON.stringify(images));
      const imageRegistry = new ImageRegistry(registry);
      expect(imageRegistry.getImage([{id: 'ruby', type: 'nami'}])).to.be.eql('test');
    });
    it('returns an image satisfying some system requirements', () => {
      const platform = {os: 'linux'};
      const registry = nos.createTempFile();
      const images = [{id: 'test', buildTools: [{id: 'zlib', type: 'system'}], platform}];
      nfile.write(registry, JSON.stringify(images));
      const imageRegistry = new ImageRegistry(registry);
      expect(imageRegistry.getImage([{id: 'zlib', type: 'system'}])).to.be.eql('test');
    });
    it('returns null if the nami requirements are not met', () => {
      const platform = {os: 'linux'};
      const registry = nos.createTempFile();
      const images = [{id: 'test', buildTools: [{id: 'ruby', type: 'nami'}], platform}];
      nfile.write(registry, JSON.stringify(images));
      const imageRegistry = new ImageRegistry(registry);
      expect(imageRegistry.getImage([{id: 'ruby2', type: 'nami'}])).to.be.eql(null);
    });
    it('returns null if the system requirements are not met', () => {
      const platform = {os: 'linux'};
      const registry = nos.createTempFile();
      const images = [{id: 'test', buildTools: [{id: 'zlib', type: 'system'}], platform}];
      nfile.write(registry, JSON.stringify(images));
      const imageRegistry = new ImageRegistry(registry);
      expect(imageRegistry.getImage([{id: 'zlib2', type: 'system'}])).to.be.eql(null);
    });
    it('returns an image if there are no requirements', () => {
      const platform = {os: 'linux'};
      const registry = nos.createTempFile();
      const images = [{id: 'test', buildTools: [], platform}];
      nfile.write(registry, JSON.stringify(images));
      const imageRegistry = new ImageRegistry(registry);
      expect(imageRegistry.getImage(null)).to.be.eql('test');
    });
    it('returns null if any available image satisfies the platform', () => {
      const platform = {os: 'linux'};
      const registry = nos.createTempFile();
      const images = [{id: 'test', buildTools: [], platform}];
      nfile.write(registry, JSON.stringify(images));
      const imageRegistry = new ImageRegistry(registry);
      expect(imageRegistry.getImage(null, {os: 'osx'})).to.be.eql(null);
    });
  });
});

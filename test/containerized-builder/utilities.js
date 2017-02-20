'use strict';

const chai = require('chai');
const utilities = require('../../lib/containerized-builder/utilities');
const expect = chai.expect;

describe('Utilities', function() {
  describe('#getImage', function() {
    it('returns an image id with just one option', () => {
      const image = utilities.getImage([{id: 'test'}]);
      expect(image).to.be.eql('test');
    });
    it('throws an error if no image is the default one', () => {
      expect(() => utilities.getImage([{id: 'test'}, {id: 'test2'}])).
      to.throw('You should mark one of the available images as "default"');
    });
    it('returns a default image', () => {
      const image = utilities.getImage([{id: 'test', default: true}, {id: 'test2'}]);
      expect(image).to.be.eql('test');
    });
    it('returns the only image that satisfies the requirements', () => {
      const image = utilities.getImage([{
        id: 'test', platform: {os: 'linux'}
      }], {os: 'linux'});
      expect(image).to.be.eql('test');
    });
    it('returns an image that satisfies the requirements', () => {
      const image = utilities.getImage([{
        id: 'test', platform: {os: 'linux'}
      }, {
        id: 'test2', platform: {os: 'linux-x64'}
      }], {os: 'linux-x64'});
      expect(image).to.be.eql('test2');
    });
    it('throws an error if the only image doesn\'t satisfy the requirements', () => {
      expect(() => utilities.getImage([{
        id: 'test', platform: {os: 'linux'}
      }], {os: 'linux-x64'})).to.throw('doesn\'t satisfy the requirements');
    });
    it('throws an error if no image satisfies the requirements', () => {
      expect(() => utilities.getImage([{
        id: 'test', platform: {os: 'linux'}
      }, {
        id: 'test2', platform: {os: 'linux'}
      }], {os: 'linux-x64'})).to.throw('Not found any image that satisfies');
    });
  });
});

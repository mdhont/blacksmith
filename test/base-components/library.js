'use strict';

const Library = require('../../lib/base-components/library');
const path = require('path');
const chai = require('chai');
const expect = chai.expect;

describe('Library', () => {
  let libraryID = '';
  let libraryVersion = '';
  let metadata = {};

  before('configure metadata', () => {
    libraryID = 'sample';
    libraryVersion = '1.0.0';
    metadata = {
      'id': libraryID,
      'version': libraryVersion
    };
  });

  describe('Library~prefix', () => {
    let library = null;

    before('prepare library', () => {
      library = new Library(metadata);
    });

    it('should return common path', () => {
      const prefix = path.join('tmp', 'blacksmith_test');
      library.setup({be: {prefixDir: prefix}}, {});
      expect(library.prefix).to.be.eql(path.join(prefix, 'common'));
    });
  });
});

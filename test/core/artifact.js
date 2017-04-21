'use strict';

const Artifact = require('../../lib/core/build-manager/artifacts/artifact');
const _ = require('lodash');
const chai = require('chai');
const expect = chai.expect;

describe('Artifact', () => {
  it('creates an instance successfully', () => {
    const inputObject = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: 'component_prefix',
      source: {
        tarball: 'test.tar.gz',
        sha256: '1234'
      },
      compiledTarball: {
        path: 'compiled-test.tar.gz',
        sha256: 'testsha256'
      },
      systemRuntimeDependencies: ['libc6']
    };
    const result = {
      metadata: {id: 'component', version: '1.0.0'},
      prefix: 'component_prefix',
      source: {
        tarball: 'test.tar.gz',
        sha256: '1234'
      },
      compiledTarball: {
        path: 'compiled-test.tar.gz',
        sha256: 'testsha256'
      },
      systemRuntimeDependencies: ['libc6']
    };
    const artifact = new Artifact(inputObject);
    _.each(result, (v, k) => expect(artifact[k]).to.be.eql(v));
    expect(artifact.builtOn).to.be.an.instanceof(Date);
  });
});

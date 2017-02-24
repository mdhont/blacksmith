'use strict';
/* eslint-disable no-unused-expressions */

describe('Core', () => {
  require('./core/artifact');
  require('./core/fstracker');
  require('./core/build-environment');
  require('./core/build-manager');
  require('./core/component-provider');
  require('./core/component-list');
  require('./core/blacksmith');
});

describe('Base Components', () => {
  require('./base-components/compilable-component');
  require('./base-components/compiled-component');
  require('./base-components/component');
  require('./base-components/library');
  require('./base-components/make-component');
});

describe('Container Builder', () => {
  require('./containerized-builder');
});

describe('Commands', () => {
  require('./commands/help');
  require('./commands/configure');
  require('./commands/inspect');
  require('./commands/build');
  require('./commands/containerized-build');
});

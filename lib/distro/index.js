'use strict';

const Debian = require('./debian');
const Centos = require('./centos');

module.exports = {
  getDistro: (distro, arch, options) => {
    let result = null;
    switch (distro) {
      case 'ubuntu': // Ubuntu
      case 'debian': {
        result = new Debian(arch, options);
        break;
      }
      case 'rhel': // RedHat
      case 'amazon': // Amazon Linux
      case 'ol': // Oracle Linux
      case 'centos': {
        result = new Centos(arch, options);
        break;
      }
      default: {
        throw new Error(`Distro type ${distro} is not supported`);
      }
    }
    return result;
  }
};

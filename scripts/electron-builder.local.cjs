const { build } = require('../package.json');

const localBuild = {
  ...build,
  publish: 'never',
  mac: {
    ...build.mac,
    target: ['dir'],
  },
};

delete localBuild.afterSign;

module.exports = localBuild;

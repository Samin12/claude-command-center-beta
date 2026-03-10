const { build } = require('../package.json');

const releaseBuild = {
  ...build,
  artifactName: 'Samins-Command-Center-${os}-${arch}.${ext}',
  mac: {
    ...build.mac,
    target: ['dmg', 'zip'],
  },
  win: {
    icon: 'public/favicon.ico',
    target: ['nsis', 'zip'],
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};

delete releaseBuild.afterSign;

module.exports = releaseBuild;

const path = require('path');
const glob = require('glob');

// initiate strategies
const strategies = Object.create(null);
const strategiesFolderPath = path.resolve(__dirname, './strategies');
const strategiesFiles = glob.sync('*.js', { cwd: strategiesFolderPath, matchBase: true });

// remove .js
strategiesFiles.forEach((filename) => {
  // eslint-disable-next-line import/no-dynamic-require
  strategies[filename.slice(0, -3)] = require(path.resolve(strategiesFolderPath, filename));
});

module.exports = strategies;

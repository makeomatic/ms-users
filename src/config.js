const path = require('path');
const { globFiles } = require('ms-conf/lib/load-config');

module.exports = globFiles(path.resolve(__dirname, 'configs'));

const path = require('path');

/**
 * Configuration for redis cluster. Currently only compatible with this
 * database
 * @type {Object}
 */
exports.redis = {
  options: {
    // attempt to fix cluster?
    keyPrefix: '{ms-users}',
    // pass this to constructor
    dropBufferSupport: false,
  },
  luaScripts: path.resolve(__dirname, '../../scripts/redis-lua'),
};

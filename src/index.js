/**
 * Exports users service
 * @return {Users}
 */
module.exports = require('./users');

module.exports.ConsulWatcher = require('./utils/consul-watcher');

module.exports.auth = {
  strategy: require('./auth/strategies'),
  jwt: require('./utils/stateless-jwt'),
};

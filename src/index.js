/**
 * Exports users service
 * @return {Users}
 */
module.exports = require('./users');

const { ConsulWatcher } = require('./utils/consul-watcher');

module.exports.ConsulWatcher = ConsulWatcher;

module.exports.auth = {
  strategy: require('./auth/strategies'),
  statelessJWT: require('./utils/stateless-jwt'),
};

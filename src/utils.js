const { ConsulWatcher } = require('./utils/consul-watcher');

module.exports = {
  ConsulWatcher,
  auth: {
    strategy: require('./auth/strategies'),
    statelessJWT: require('./utils/stateless-jwt'),
  },
};

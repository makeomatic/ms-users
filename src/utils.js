const { ConsulWatcher } = require('./utils/consul-watcher');
const { CredentialsStore } = require('./utils/credentials-store');

module.exports = {
  ConsulWatcher,
  CredentialsStore,
  auth: {
    strategy: require('./auth/strategies'),
    statelessJWT: require('./utils/stateless-jwt'),
  },
};

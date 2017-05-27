const Promise = require('bluebird');
const { signData } = require('../../../utils/jwt');

/**
 * Sign account data with a secure jwt token
 * @param {Object} account
 * @return {Promise}
 */
module.exports = function getSignedToken(account) {
  const { provider } = account;

  return Promise
    .bind(this, [account, this.config.oauth.token])
    .spread(signData)
    .then(token => ({
      token,
      provider,
    }));
};

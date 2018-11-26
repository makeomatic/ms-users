const Promise = require('bluebird');
const { signData, verifyData } = require('../../../utils/jwt');

/**
 * Sign account data with a secure jwt token
 * @param {Object} account
 * @return {Promise}
 */
async function getSignedToken(account) {
  const { provider } = account;

  const token = await Promise
    .bind(this, [account, this.config.oauth.token])
    .spread(signData);

  return {
    token,
    provider,
  };
}

/**
 * Verifies previously signed token
 * @param  {string} token
 * @return {Object} account data
 */
async function verifySignedToken(token) {
  return verifyData(token, this.config.oauth.token);
}

exports.getSignedToken = getSignedToken;
exports.verifySignedToken = verifySignedToken;

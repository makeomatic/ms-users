const Promise = require('bluebird');
const jwt = require('../utils/jwt.js');
const getMetadata = require('./getMetadata.js');

/**
 * Verifies that passed token is signed correctly, returns associated metadata with it
 *
 * @param  {Object}   opts
 * @returns {Promise}
 */
module.exports = function verify(opts) {
  const { defaultAudience } = this.config.jwt;
  const { token, audience: _audience, peek } = opts;
  const audience = Array.isArray(_audience) ? _audience : [ _audience ];

  return jwt
    .verify.call(this, token, audience, peek)
    .bind(this)
    .then(function decodedToken(decoded) {
      if (audience.indexOf(defaultAudience) === -1) {
        audience.push(defaultAudience);
      }

      // get metadata and return success
      const username = decoded.username;
      return Promise.props({
        username,
        metadata: getMetadata.call(this, username, audience),
      });
    });
};

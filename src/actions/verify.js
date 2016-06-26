const Promise = require('bluebird');
const jwt = require('../utils/jwt.js');
const getMetadata = require('../utils/getMetadata.js');

/**
 * @api {amqp} <prefix>.verify JWT verification
 * @apiVersion 1.0.0
 * @apiName verifyJWT
 * @apiGroup Users
 *
 * @apiDescription Verifies passed JWT and returns deserialized user object. Must be used for session management
 *
 * @apiParam (Payload) {String} token - signed JWT token
 * @apiParam (Payload) {String[]} audience - which namespaces of metadata to return
 *
 */
module.exports = function verify(opts) {
  const { defaultAudience } = this.config.jwt;
  const { token, audience: _audience, peek } = opts;
  const audience = Array.isArray(_audience) ? _audience : [_audience];

  return Promise
    .bind(this, [token, audience, peek])
    .spread(jwt.verify)
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

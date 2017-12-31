const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const jwt = require('../utils/jwt.js');
const getMetadata = require('../utils/getMetadata.js');

/**
 * Internal functions
 */
const { isArray } = Array;
const toArray = maybeArray => (isArray(maybeArray) ? maybeArray : [maybeArray]);

/**
 * Verifies decoded token
 */
function decodedToken({ username }) {
  if (!username) {
    throw new HttpStatusError(403, 'forged or expired token');
  }

  const { audience, defaultAudience, service } = this;

  // push extra audiences
  if (audience.indexOf(defaultAudience) === -1) {
    audience.push(defaultAudience);
  }

  // get metadata and return success
  return Promise.props({
    username,
    metadata: getMetadata.call(service, username, audience),
  });
}

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
 * @apiParam (Payload) {Boolean} [peek=false] - whether to update last access or not
 * @apiParam (Payload) {Boolean} [accessToken=false] - uses internal token verification if set to true
 *
 */
module.exports = function verify({ params }) {
  // basic context
  const audience = toArray(params.audience);
  const { token, peek, accessToken } = params;

  // internal context
  const ctx = {
    service: this,
    defaultAudience: this.config.jwt.defaultAudience,
    token,
    audience,
  };

  return Promise
    .bind(this, [token, audience, peek])
    .spread(accessToken ? jwt.internal : jwt.verify)
    .bind(ctx)
    .then(decodedToken);
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];

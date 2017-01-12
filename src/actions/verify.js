const Promise = require('bluebird');
const jwt = require('../utils/jwt.js');
const getMetadata = require('../utils/getMetadata.js');

/**
 * Internal functions
 */
const isArray = Array.isArray;
const toArray = maybeArray => (isArray(maybeArray) ? maybeArray : [maybeArray]);

/**
 * Verifies decoded token
 */
function decodedToken(decoded) {
  const { audience, defaultAudience, service } = this;

  // push extra audiences
  if (audience.indexOf(defaultAudience) === -1) {
    audience.push(defaultAudience);
  }

  // get metadata and return success
  const username = decoded.username;
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
 *
 */
function verify({ params }) {
  // basic context
  const audience = toArray(params.audience);
  const token = params.token;
  const peek = params.peek;

  // internal context
  const ctx = {
    service: this.service,
    defaultAudience: this.config.jwt.defaultAudience,
    token,
    audience,
  };

  return Promise
    .bind(this, [token, audience, peek])
    .spread(jwt.verify)
    .bind(ctx)
    .then(decodedToken);
}

module.exports = verify;

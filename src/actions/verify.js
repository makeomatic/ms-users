const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const jwt = require('../utils/jwt.js');
const getMetadata = require('../utils/getMetadata.js');

/**
 * Internal functions
 */
const isArray = Array.isArray;
const toArray = maybeArray => (isArray(maybeArray) ? maybeArray : [maybeArray]);

/**
 * @TODO comment (userId)
 * Verifies decoded token
 */
function decodedToken({ username: userId }) {
  if (!userId) {
    throw new HttpStatusError(403, 'forged or expired token');
  }

  const { audience, defaultAudience, service } = this;

  // push extra audiences
  if (audience.indexOf(defaultAudience) === -1) {
    audience.push(defaultAudience);
  }

  // get metadata and return success
  return Promise.props({
    id: userId,
    metadata: getMetadata.call(service, userId, audience),
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
function verify({ params }) {
  // basic context
  const audience = toArray(params.audience);
  const token = params.token;
  const peek = params.peek;
  const accessToken = params.accessToken;

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
}

module.exports = verify;

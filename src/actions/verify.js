const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const { ActionTransport } = require('@microfleet/core');
const jwt = require('../utils/jwt');
const getMetadata = require('../utils/getMetadata');
const { getUserId } = require('../utils/userData');

/**
 * Internal functions
 */
const { isArray } = Array;
const toArray = maybeArray => (isArray(maybeArray) ? maybeArray : [maybeArray]);

/**
 * Verifies decoded token
 */
function decodedToken({ username, userId }) {
  if (!userId && !username) {
    throw new HttpStatusError(403, 'forged or expired token');
  }

  const { audience, defaultAudience, service } = this;

  // push extra audiences
  if (audience.indexOf(defaultAudience) === -1) {
    audience.push(defaultAudience);
  }

  return Promise
    .resolve(userId || getUserId.call(service, username))
    .then(resolveduserId => Promise.props({
      id: resolveduserId,
      metadata: getMetadata.call(service, resolveduserId, audience),
    }));
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
function Verify({ params }) {
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
}

Verify.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = Verify;

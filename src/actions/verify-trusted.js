const { ActionTransport } = require('@microfleet/plugin-router');

const { USERS_AUDIENCE_MISMATCH } = require('../constants');
const { fromTokenData } = require('../utils/verify');

/**
 * Internal functions
 */
const { isArray } = Array;
const toArray = (maybeArray) => (isArray(maybeArray) ? maybeArray : [maybeArray]);

/**
 * @api {amqp} <prefix>.verify-trusted Trusted JWT verification,
 * @apiVersion 1.0.0
 * @apiName verifyTrustedJWT
 * @apiGroup Users
 *
 * @apiDescription Uses external check result headers and returns deserialized user object. Must be used for session management
 *
 * @apiParam (Payload) {String} jsonToken - decoded JWT token
 * @apiParam (Payload) {String[]} audience - which namespaces of metadata to return
 *
 */
async function Verify({ params }) {
  const audience = toArray(params.audience);
  const { jsonToken } = params;
  const decodedToken = JSON.parse(jsonToken);

  if (audience.indexOf(decodedToken.aud) === -1) {
    throw USERS_AUDIENCE_MISMATCH;
  }

  return fromTokenData(this, decodedToken, {
    defaultAudience: this.config.jwt.defaultAudience,
    audience,
  });
}

Verify.transports = [ActionTransport.amqp, ActionTransport.internal];
Verify.validateResponse = false;
module.exports = Verify;

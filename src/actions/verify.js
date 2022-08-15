const { ActionTransport } = require('@microfleet/plugin-router');

const jwt = require('../utils/jwt');
const { fromTokenData } = require('../utils/verify');

/**
 * Internal functions
 */
const { isArray } = Array;
const toArray = (maybeArray) => (isArray(maybeArray) ? maybeArray : [maybeArray]);

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
async function Verify({ params }) {
  const audience = toArray(params.audience);
  const { token, peek, accessToken } = params;

  const decodedToken = await (accessToken
    ? jwt.internal(this, token, audience, peek)
    : jwt.verify(this, token, audience, peek)
  );

  return fromTokenData(this, decodedToken, {
    defaultAudience: this.config.jwt.defaultAudience,
    audience,
  });
}

Verify.validateResponse = true;
Verify.responseSchema = 'verify.response';
Verify.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = Verify;

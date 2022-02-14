const { ActionTransport } = require('@microfleet/plugin-router');

const jwt = require('../utils/jwt');

/**
 * @api {amqp} <prefix>.refresh Refresh JWT token
 * @apiVersion 1.0.0
 * @apiName refreshJWT
 * @apiGroup Users
 *
 * @apiDescription Refreshes passed Refresh Token and returns deserialized user object. Must be used for session management
 *
 * @apiParam (Payload) {String} token - signed JWT token
 * @apiParam (Payload) {String[]} audience - which namespaces of metadata to return
 *
 */
async function refreshToken({ params }) {
  const audience = Array.isArray(params.audience) ? params.audience : [params.audience];
  const { token } = params;

  return jwt.refresh.call(this, token, audience);
}

refreshToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = refreshToken;

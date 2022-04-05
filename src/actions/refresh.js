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
 * @apiParam (Payload) {String} audience - token audience
 *
 */
async function refreshToken({ params }) {
  const { token, audience } = params;

  return jwt.refresh.call(this, token, audience);
}

refreshToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = refreshToken;

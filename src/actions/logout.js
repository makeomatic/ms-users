const { ActionTransport } = require('mservice');
const jwt = require('../utils/jwt.js');

/**
 * @api {amqp} <prefix>.logout Logout
 * @apiVersion 1.0.0
 * @apiName LogoutUser
 * @apiGroup Users
 *
 * @apiDescription Invalidates JWT token, must be verified based on audience.
 *
 * @apiParam (Payload) {String} jwt - signed JWT token
 * @apiParam (Payload) {String} audience - verifies that JWT is for this audience
 *
 */
function logout(request) {
  const { jwt: token, audience } = request.params;
  return jwt.logout.call(this, token, audience);
}

logout.schema = 'logout';

logout.transports = [ActionTransport.amqp];

module.exports = logout;

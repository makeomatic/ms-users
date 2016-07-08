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
module.exports = function logout(opts) {
  const { jwt: token, audience } = opts;
  return jwt.logout.call(this, token, audience);
};

const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const jwt = require('../utils/jwt');

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
function logout({ params }) {
  return Promise
    .bind(this, [params.token, params.audience])
    .spread(jwt.logout);
}

logout.transports = [ActionTransport.amqp];

module.exports = logout;

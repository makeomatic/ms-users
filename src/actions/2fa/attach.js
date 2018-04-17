const { ActionTransport } = require('@microfleet/core');

/**
 * @api {amqp} <prefix>.attach Attach
 * @apiVersion 1.0.0
 * @apiName Attach
 * @apiGroup Users
 *
 * @apiDescription Allows to attach secret key and recovery code to user's account,
 * generate and returns initial recovery code.
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String} secret - crypto secure 32 characters hex key
 * @apiParam (Payload) {String} totp - time-based one time password
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function attach() {
  // pass
};

module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

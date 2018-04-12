/**
 * @api {amqp} <prefix>.verify Verify TOTP
 * @apiVersion 1.0.0
 * @apiName Verify
 * @apiGroup Users
 *
 * @apiDescription Allows to verify if TOTP provided by the user is valid.
 *
 * @apiParam (Payload) {Number} [totp] - time-based one time password
 * @apiParam (Payload) {String} [recoveryCode] - crypto secure 8 characters hex key
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function verify() {
  // pass
};

module.exports.transports = [require('@microfleet/core').ActionTransport.amqp];

const { ActionTransport } = require('@microfleet/core');

/**
 * @api {amqp} <prefix>.verify Verify TOTP
 * @apiVersion 1.0.0
 * @apiName Verify
 * @apiGroup Users
 *
 * @apiDescription Allows to verify if TOTP provided by the user is valid.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 *
 * @apiParam (Payload) {Number} [totp] - time-based one time password
 * @apiParam (Payload) {String} [recoveryCode] - crypto secure 8 characters hex key
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function verify() {
  // pass
};

module.exports.auth = 'bearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

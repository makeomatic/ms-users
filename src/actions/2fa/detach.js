const { ActionTransport } = require('@microfleet/core');

/**
 * @api {amqp} <prefix>.detach Detach
 * @apiVersion 1.0.0
 * @apiName Detach
 * @apiGroup Users
 *
 * @apiDescription Allows to detach secret key and recovery code from user's account,
 * basically disables 2FA.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} [totp] - time-based one time password
 * @apiParam (Payload) {String} [recoveryCode] - crypto secure 8 characters hex key
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function detach() {
  // pass
};

module.exports.auth = 'bearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

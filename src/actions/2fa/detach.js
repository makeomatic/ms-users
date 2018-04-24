const { ActionTransport } = require('@microfleet/core');
const hasTotp = require('../../utils/hasTotp.js');

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
 * @apiHeader (Authorization) {String} X-Auth-TOTP TOTP or recoveryCode
 * @apiHeaderExample X-Auth-TOTP-Example:
 *     "X-Auth-TOTP: 123456"
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} [totp] - 6 chars time-based one time password or
 * 8 characters hex recovery code
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function detach() {
  // pass
};

module.exports.allowed = hasTotp;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

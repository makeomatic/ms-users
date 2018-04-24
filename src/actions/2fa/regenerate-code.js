const { ActionTransport } = require('@microfleet/core');
const hasTotp = require('../../utils/hasTotp.js');

/**
 * @api {amqp} <prefix>.regenerate-code Regenerate recovery code
 * @apiVersion 1.0.0
 * @apiName RegenerateCode
 * @apiGroup Users
 *
 * @apiDescription Allows regenerate recovery code.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 * @apiHeader (Authorization) {String} X-Auth-TOTP TOTP or recoveryCode
 * @apiHeaderExample X-Auth-TOTP-Example:
 *     "X-Auth-TOTP: 123456"
 *
 * @apiParam (Payload) {Number} [totp] - time-based one time password
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function regenerateCode() {
  // pass
};

module.exports.allowed = hasTotp;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

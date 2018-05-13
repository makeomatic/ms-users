const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const { checkTotp } = require('../../utils/2fa.js');

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
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} totp - 6 chars time-based one time password or
 * 8 characters hex recovery code
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function verify() {
  return Promise.resolve({ valid: true });
};

module.exports.tfa = true;
module.exports.allowed = checkTotp;
module.exports.transports = [ActionTransport.amqp];

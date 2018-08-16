const { ActionTransport } = require('@microfleet/core');
const { checkMFA } = require('../../utils/mfa.js');
const { MFA_TYPE_REQUIRED } = require('../../constants');

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
  return { valid: true };
};

module.exports.mfa = MFA_TYPE_REQUIRED;
module.exports.allowed = checkMFA;
module.exports.transports = [ActionTransport.amqp];
module.exports.transportOptions = {
  [ActionTransport.amqp]: {
    methods: [ActionTransport.amqp],
  },
};

const { ActionTransport } = require('@microfleet/plugin-router');

const { checkMFA } = require('../../utils/mfa');
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
function verify() {
  return { valid: true };
}

verify.mfa = MFA_TYPE_REQUIRED;
verify.allowed = checkMFA;
verify.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = verify;

const { ActionTransport } = require('@microfleet/core');
const Errors = require('common-errors');

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

module.exports.allowed = function isAllowed({ params, headers }) {
  if (params.totp || headers['X-Auth-TOTP']) {
    return null;
  }

  throw new Errors.HttpStatusError(403, 'TOTP required');
};

module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

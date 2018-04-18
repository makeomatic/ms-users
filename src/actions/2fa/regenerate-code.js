const { ActionTransport } = require('@microfleet/core');

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
 *
 * @apiParam (Payload) {Number} totp - time-based one time password
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function regenerateCode() {
  // pass
};

module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

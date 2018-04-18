const { ActionTransport } = require('@microfleet/core');

/**
 * @api {amqp} <prefix>.generate-key Generates secret key
 * @apiVersion 1.0.0
 * @apiName GenerateKey
 * @apiGroup Users
 *
 * @apiDescription Generates secret key for 2FA.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 *
 * @apiParam (Payload) {String} username - id of the user
 *
 */
module.exports = function generateKey() {
  // pass
};

module.exports.auth = 'bearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

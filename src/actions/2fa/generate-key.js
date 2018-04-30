const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const generateSecret = Promise.promisify(require('2fa').generateKey);

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
 */
module.exports = function generateKey() {
  return generateSecret()
    .then(secret => ({ secret }));
};

module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

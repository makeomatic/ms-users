const { ActionTransport } = require('@microfleet/core');
const authenticator = require('otplib/authenticator');
const crypto = require('crypto');

authenticator.options = { crypto };

/**
 * @api {amqp} <prefix>.generate-key Generates secret key
 * @apiVersion 1.0.0
 * @apiName GenerateKey
 * @apiGroup Users
 *
 * @apiDescription Generates secret key for MFA.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 *
 */
function generateKey() {
  return { secret: authenticator.generateSecret() };
}

generateKey.auth = 'httpBearer';
generateKey.transports = [ActionTransport.http, ActionTransport.amqp, ActionTransport.internal];
generateKey.transportOptions = {
  [ActionTransport.http]: {
    methods: ['get'],
  },
};

module.exports = generateKey;

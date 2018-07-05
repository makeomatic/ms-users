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
 * @apiDescription Generates secret key for 2FA.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 *
 */
module.exports = function generateKey() {
  return { secret: authenticator.generateSecret() };
};

module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];
module.exports.transportOptions = {
  [ActionTransport.http]: {
    methods: ['get'],
  },
  [ActionTransport.amqp]: {
    methods: [ActionTransport.amqp],
  },
};

const { ActionTransport } = require('@microfleet/core');
const authenticator = require('otplib/authenticator');
const crypto = require('crypto');
const { USERS_ALIAS_FIELD, USERS_USERNAME_FIELD } = require('../../constants');

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
function generateKey({ auth, params }) {
  const audience = this.config.jwt.defaultAudience;
  const secret = authenticator.generateSecret(this.config.mfa.length);
  const response = { secret };
  const username = auth
    ? (
      auth.credentials.metadata[audience][USERS_ALIAS_FIELD]
      || auth.credentials.metadata[audience][USERS_USERNAME_FIELD]
    )
    : params.username;

  if (username) {
    response.uri = authenticator.keyuri(username, this.config.mfa.serviceName, secret);
  }

  return response;
}

generateKey.auth = 'httpBearer';
generateKey.transports = [ActionTransport.http, ActionTransport.amqp, ActionTransport.internal];
generateKey.transportOptions = {
  [ActionTransport.http]: {
    methods: ['get'],
  },
};

module.exports = generateKey;

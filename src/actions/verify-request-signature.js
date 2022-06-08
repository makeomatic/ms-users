const { ActionTransport } = require('@microfleet/plugin-router');
const { USERS_USERNAME_FIELD } = require('../constants');

const { fromTokenData } = require('../utils/verify');
const { validateRequestSignature } = require('../utils/signed-request');

const { isArray } = Array;
const toArray = (maybeArray) => (isArray(maybeArray) ? maybeArray : [maybeArray]);

/**
 * @api {amqp} <prefix>.verify-request-signature Retrieve user information by provided request signature,
 * @apiVersion 1.0.0
 * @apiName verifyRequestSignature
 * @apiGroup Users
 *
 * @apiParam (Payload) {String[]|String} audience - which namespaces of metadata to return
 * @apiParam (Payload) {Object} request - request like object
 * @apiParam (Payload) {Object} request.headers - headers passed in request
 * @apiParam (Payload) {Object} request.method - request method
 * @apiParam (Payload) {string} request.url - requested url
 * @apiParam (Payload) {string} request.params - request params
 */
async function Verify({ params }) {
  const { request } = params;
  const audience = toArray(params.audience);

  const { userId, signKey, scopes } = await validateRequestSignature(this, request);
  const keyAndUserData = await fromTokenData(
    this,
    {
      [USERS_USERNAME_FIELD]: userId,
      signKey,
      scopes,
    },
    {
      defaultAudience: this.config.jwt.defaultAudience,
      audience,
    }
  );

  return keyAndUserData;
}

Verify.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = Verify;

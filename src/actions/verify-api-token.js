const { ActionTransport } = require('@microfleet/plugin-router');

const { getToken } = require('../utils/api-token');
const { fromTokenData } = require('../utils/verify');
const { USERS_USERNAME_FIELD } = require('../constants');

/**
 * Internal functions
 */
const { isArray } = Array;
const toArray = (maybeArray) => (isArray(maybeArray) ? maybeArray : [maybeArray]);

/**
 * @api {amqp} <prefix>.verify-api-token Trusted JWT verification,
 * @apiVersion 1.0.0
 * @apiName verifyApiToken
 * @apiGroup Users
 *
 * @apiDescription Returns user metadata and scopes associated with token
 *
 * @apiParam (Payload) {String} uuid - id of the token
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String[]} audience - which namespaces of metadata to return
 *
 */
async function Verify({ params }) {
  const audience = toArray(params.audience);
  const { uuid, username } = params;
  const { userId, scopes } = await getToken(this, `${username}.${uuid}`);

  const keyAndUserData = await fromTokenData(
    this,
    {
      [USERS_USERNAME_FIELD]: userId,
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
Verify.validateResponse = false;
module.exports = Verify;

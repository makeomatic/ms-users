const { ActionTransport } = require('@microfleet/plugin-router');
const { getToken } = require('../utils/api-token');
const { USERS_USERNAME_FIELD, USERS_INVALID_TOKEN } = require('../constants');

const { fromTokenData } = require('../utils/verify');

const { isArray } = Array;
const toArray = (maybeArray) => (isArray(maybeArray) ? maybeArray : [maybeArray]);

/**
 * @api {amqp} <prefix>.verify-key-id Retrieve user information by provided access key id,
 * @apiVersion 1.0.0
 * @apiName verifyKeyId
 * @apiGroup Users
 *
 * @apiDescription NOT SECURE without external payload and signature check
 *
 * @apiParam (Payload) {String} keyId - key id
 * @apiParam (Payload) {String[]} audience - which namespaces of metadata to return
 *
 */
async function Verify({ params }) {
  const { keyId } = params;
  const audience = toArray(params.audience);
  const [userId] = keyId.split('.');
  const { raw: signKey, type } = await getToken(this, keyId, true);

  if (type !== 'sign') {
    throw USERS_INVALID_TOKEN;
  }

  return fromTokenData(
    this,
    {
      [USERS_USERNAME_FIELD]: userId,
    },
    {
      defaultAudience: this.config.jwt.defaultAudience,
      audience,
      signKey,
    }
  );
}

Verify.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = Verify;

const { ActionTransport } = require('@microfleet/plugin-router');

const redisKey = require('../../utils/key');

const { getUserId } = require('../../utils/userData');
const { USERS_API_TOKENS } = require('../../constants');
const { checkTokenData, deserializeTokenData } = require('../../utils/api-token');

/**
 * @api {amqp} <prefix>.token.get Get Token information
 * @apiVersion 1.0.0
 * @apiName GetToken
 * @apiGroup Tokens
 *
 * @apiDescription This method allows to retrieve access token information.
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String} token - used to identify token
 */
async function getToken({ params }) {
  const { username, token } = params;
  const { redis } = this;

  const userId = await getUserId.call(this, username);

  // transform input
  const payload = `${userId}.${token}`;
  const key = redisKey(USERS_API_TOKENS, payload);

  const tokenData = await redis.hgetall(key);
  checkTokenData(tokenData);

  return deserializeTokenData(tokenData);
}

getToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = getToken;

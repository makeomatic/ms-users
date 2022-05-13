const { ActionTransport } = require('@microfleet/plugin-router');

const redisKey = require('../../utils/key');

const { getUserId } = require('../../utils/userData');
const { USERS_API_TOKENS } = require('../../constants');
const { checkTokenData } = require('../../utils/api-token');

/**
 * @api {amqp} <prefix>.token.update Update Token
 * @apiVersion 1.0.0
 * @apiName UpdateToken
 * @apiGroup Tokens
 *
 * @apiDescription This method allows to update an access tokens scopes.
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String} token - used to identify token
 * @apiParam (Payload) {String} [scopes] - access scopes of the token
 */
async function updateToken({ params }) {
  const { username, token, scopes } = params;
  const { redis } = this;

  const userId = await getUserId.call(this, username);

  // transform input
  const payload = `${userId}.${token}`;
  const key = redisKey(USERS_API_TOKENS, payload);

  checkTokenData(await redis.hgetall(key));

  await redis.hset(key, { scopes: JSON.stringify(scopes) });

  return token;
}

updateToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = updateToken;

const { v4: uuid } = require('uuid');
const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');
const { sign } = require('../../utils/signatures');
const redisKey = require('../../utils/key');
const handlePipelineError = require('../../utils/pipeline-error');
const { getUserId } = require('../../utils/userData');
const { USERS_API_TOKENS, USERS_API_TOKENS_ZSET, BEARER_USERNAME_FIELD } = require('../../constants');

function storeData(userId) {
  const { redis, name } = this;
  const tokenPart = uuid();

  // transform input
  const payload = `${userId}.${tokenPart}`;
  const signature = sign.call(this, payload);
  const token = `${payload}.${signature}`;

  // stores all issued keys and it's date
  const key = redisKey(USERS_API_TOKENS, payload);
  const zset = redisKey(USERS_API_TOKENS_ZSET, userId);

  // prepare to store
  return redis
    .pipeline()
    .hmset(key, {
      [BEARER_USERNAME_FIELD]: userId,
      name,
      uuid: tokenPart,
    })
    .zadd(zset, Date.now(), payload)
    .exec()
    .then(handlePipelineError)
    .return(token);
}

/**
 * @api {amqp} <prefix>.token.create Create Token
 * @apiVersion 1.0.0
 * @apiName CreateToken
 * @apiGroup Tokens
 *
 * @apiDescription This method allows to create an access token, which can be used instead of
 *   username+password exchanged for JWT. This is usable directly in .verify, but requires special flag
 *   passed to indicate type of token being used
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String} name - used to identify token
 */
function createToken({ params }) {
  const { username, name } = params;
  const { redis, config } = this;
  const context = { name, redis, config };

  return Promise
    .bind(context, username)
    .then(getUserId)
    .then(storeData);
}

createToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = createToken;

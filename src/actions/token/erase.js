const Promise = require('bluebird');

const { ActionTransport } = require('../../re-export');

const redisKey = require('../../utils/key');
const handlePipelineError = require('../../utils/pipeline-error');
const { USERS_API_TOKENS, USERS_API_TOKENS_ZSET } = require('../../constants');
const { getUserId } = require('../../utils/userData');

function eraseData(userId) {
  const { redis, token } = this;
  const payload = `${userId}.${token}`;

  // zset & key
  const zset = redisKey(USERS_API_TOKENS_ZSET, userId);
  const key = redisKey(USERS_API_TOKENS, payload);

  // remove key
  return redis
    .pipeline()
    .del(key)
    .zrem(zset, payload)
    .exec()
    .then(handlePipelineError);
}

/**
 * @api {amqp} <prefix>.token.erase Erase Token
 * @apiVersion 1.0.0
 * @apiName EraseToken
 * @apiGroup Tokens
 *
 * @apiDescription This method invalidates tokens from future use. Token is uuidv4() generated earlier
 *  and username is who it belongs to
 *
 * @apiParam (Payload) {String} token - token to be invalidated
 * @apiParam (Payload) {String} username - token owner
 */
function eraseToken({ params }) {
  const { username, token } = params;
  const { redis, config } = this;
  const context = { token, redis, config };

  return Promise
    .bind(context, username)
    .then(getUserId)
    .then(eraseData);
}

eraseToken.transports = [ActionTransport.amqp];

module.exports = eraseToken;

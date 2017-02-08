const redisKey = require('../../utils/key');
const md5 = require('md5');
const handlePipelineError = require('../../utils/pipelineError');
const { USERS_API_TOKENS, USERS_API_TOKENS_ZSET } = require('../../constants');

/**
 * @api {amqp} <prefix>.token.erase Create Token
 * @apiVersion 1.0.0
 * @apiName EraseToken
 * @apiGroup Tokens
 *
 * @apiDescription This method invalidates tokens from future use. Token is uuid.v4() generated earlier
 *  and username is who it belongs to
 *
 * @apiParam (Payload) {String} token - token to be invalidated
 * @apiParam (Payload) {String} username - token owner
 *
 */
module.exports = function eraseToken({ params }) {
  const { username, token } = params;
  const payload = `${md5(username)}.${token}`;

  // zset & key
  const zset = redisKey(USERS_API_TOKENS_ZSET, username);
  const key = redisKey(USERS_API_TOKENS, payload);

  // remove key
  return this.redis.pipeline()
    .del(key)
    .zrem(zset, payload)
    .exec()
    .then(handlePipelineError);
};

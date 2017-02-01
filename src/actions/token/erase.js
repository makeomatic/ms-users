const Errors = require('common-errors');
const redisKey = require('../../utils/key');
const md5 = require('md5');
const handlePipelineError = require('../../utils/pipelineError');
const { USERS_API_TOKENS, USERS_API_TOKENS_ZSET } = require('../../constants');
const { verify: verifyHMAC } = require('../../utils/signatures');

/**
 * @api {amqp} <prefix>.token.erase Create Token
 * @apiVersion 1.0.0
 * @apiName EraseToken
 * @apiGroup Tokens
 *
 * @apiDescription This method invalidates tokens from future use. Token includes
 *  username encoded in it, so that we can recreate database keys from it for verification
 *
 * @apiParam (Payload) {String} token - token to be invalidated
 * @apiParam (Payload) {String} [username] - verifies username
 *
 */
module.exports = function eraseToken({ params }) {
  const tokenParts = params.token.split('.');

  if (tokenParts.length !== 3) {
    throw new Errors.HttpStatusError(403, 'malformed token');
  }

  // if external API didn't pass username we don't verify it at all
  if (params.username && tokenParts[0] !== md5(params.username)) {
    throw new Errors.HttpStatusError(403, 'malformed token');
  }

  const signature = tokenParts.pop();
  const payload = tokenParts.join('.');
  const isValid = verifyHMAC.call(this, payload, signature);

  if (!isValid) {
    throw new Errors.HttpStatusError(403, 'malformed token');
  }

  // zset & key
  const zset = redisKey(USERS_API_TOKENS_ZSET, params.username);
  const key = redisKey(USERS_API_TOKENS, payload);

  // remove key
  return this.redis.pipeline()
    .del(key)
    .zrem(zset, payload)
    .exec()
    .then(handlePipelineError);
};

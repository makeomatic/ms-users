const uuid = require('node-uuid');
const md5 = require('md5');
const { USERS_API_TOKENS, USERS_API_TOKENS_ZSET } = require('../../constants');
const { sign } = require('../../utils/signatures');
const redisKey = require('../../utils/key');
const handlePipelineError = require('../../utils/pipelineError');

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
 *
 */
module.exports = function createToken({ params }) {
  const { username, name } = params;
  const tokenPart = uuid.v4();
  const redis = this.redis;

  // transform input
  const hashedUsername = md5(username);
  const payload = `${hashedUsername}.${tokenPart}`;
  const signature = sign.call(this, payload);
  const token = `${payload}.${signature}`;

  // stores all issued keys and it's date
  const key = redisKey(USERS_API_TOKENS, payload);
  const zset = redisKey(USERS_API_TOKENS_ZSET, username);

  // prepare to store
  return redis
    .pipeline()
    .hmset(key, { username, name, uuid: tokenPart })
    .zadd(zset, Date.now(), payload)
    .exec()
    .then(handlePipelineError)
    .return(token);
};

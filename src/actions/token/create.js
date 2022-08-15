const uuidv4 = require('uuid').v4;
const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/plugin-router');

const { sign } = require('../../utils/signatures');
const redisKey = require('../../utils/key');
const handlePipelineError = require('../../utils/pipeline-error');
const { getUserId } = require('../../utils/userData');
const { USERS_API_TOKENS, USERS_API_TOKENS_ZSET, BEARER_USERNAME_FIELD } = require('../../constants');
const { serializeTokenData, API_TOKEN_TYPE_SIGN } = require('../../utils/api-token');

function storeData(userId) {
  const { redis, name, scopes, type } = this;
  const tokenPart = uuidv4();

  const payload = `${userId}.${tokenPart}`;
  const signature = sign.call(this, payload);
  const token = `${payload}.${signature}`;

  // stores all issued keys and it's date
  const key = redisKey(USERS_API_TOKENS, payload);
  const zset = redisKey(USERS_API_TOKENS_ZSET, userId);

  const tokenData = {
    name,
    uuid: tokenPart,
    scopes,
    type,
    [BEARER_USERNAME_FIELD]: userId,
  };

  if (type === API_TOKEN_TYPE_SIGN) {
    tokenData.raw = token;
  }

  const redisData = serializeTokenData(tokenData);

  // prepare to store
  return redis
    .pipeline()
    .hmset(key, redisData)
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
 * @apiParam (Payload) {String} [scopes] - access scopes of the token
 * @apiParam (Payload) {String} [type] - access token type
 */
function createToken({ params }) {
  const { username, name, scopes, type } = params;
  const { redis, config } = this;
  const context = { name, redis, config, scopes, type };

  return Promise
    .bind(context, username)
    .then(getUserId)
    .then(storeData);
}

createToken.validateResponse = false;
createToken.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = createToken;

const Promise = require('bluebird');
const redisKey = require('../../utils/key');
const handlePipelineError = require('../../utils/pipeline-error');
const { USERS_API_TOKENS_ZSET, USERS_API_TOKENS } = require('../../constants');
const { getUserId } = require('../../utils/userData');

/**
 * Parses redis response and returns keys, as well as date of publication
 */
function parseResponse(keysAndScores) {
  const length = keysAndScores.length / 2;
  const data = new Array(length);
  const tokens = new Array(length);

  // token ref & score, data returns in pairs
  // [member, score, member, score]
  for (let i = 0; i < length; i += 1) {
    const idx = 2 * i;
    tokens[i] = keysAndScores[idx];
    data[i] = { added: +keysAndScores[idx + 1] };
  }

  return { data, tokens };
}

/**
 * Forms pipeline
 */
function getAllFromPipeline(token) {
  this.hgetall(redisKey(USERS_API_TOKENS, token));
}

/**
 * Merges fetched data from redis
 */
function mergeWithData(prop, idx) {
  Object.assign(this[idx], prop);
}

/**
 * Enriches response by metadata
 */
function enrichResponse({ data, tokens }) {
  const pipeline = this.redis.pipeline();

  tokens.forEach(getAllFromPipeline, pipeline);

  return pipeline
    .exec()
    .then(handlePipelineError)
    .bind(data)
    .each(mergeWithData)
    .return(data);
}

function getList(userId) {
  const { redis, page, pageSize } = this;
  const setKey = redisKey(USERS_API_TOKENS_ZSET, userId);

  // we only return 20 last keys, not to put too much pressure into this
  return redis
    .zrevrangebyscore(setKey, '+inf', '-inf', 'WITHSCORES', 'LIMIT', page * pageSize, pageSize)
    .then(parseResponse)
    .bind(this)
    .then(enrichResponse);
}

/**
 * @api {amqp} <prefix>.token.list List Tokens
 * @apiVersion 1.0.0
 * @apiName ListTokens
 * @apiGroup Tokens
 *
 * @apiDescription This method lists issued tokens to the passed user
 *  It only returns description of the token and the day it was last issued
 *  and accessed, not the token itself
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} [page=0] - number of page to return, defaults to 0
 * @apiParam (Payload) {Number} [pageSize=20] - page size
 */
function listTokens({ params }) {
  const { username, page, pageSize } = params;
  const { redis, config } = this;
  const context = {
    redis, config, page, pageSize,
  };

  return Promise
    .bind(context, username)
    .then(getUserId)
    .then(getList);
}

listTokens.readonly = true;
listTokens.transports = [require('@microfleet/core').ActionTransport.amqp];

module.exports = listTokens;

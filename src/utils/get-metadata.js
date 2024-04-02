const Promise = require('bluebird');
const redisKey = require('./key');
const { USERS_METADATA } = require('../constants');

const { isArray } = Array;
const JSONParse = (data) => JSON.parse(data);

async function partialMeta(redis, key, resp, fields) {
  const datum = await redis.hmget(key, fields);
  for (const [idx, field] of fields.entries()) {
    const value = datum[idx];
    if (value !== null) {
      resp[field] = JSONParse(datum[idx]);
    }
  }
}

async function fullMeta(redis, key, resp) {
  const datum = await redis.hgetall(key);
  for (const [field, value] of Object.entries(datum)) {
    resp[field] = JSONParse(value);
  }
}

/**
 * @param {Microfleet} ctx - microfleet instance
 * @param {string} userId - retrieve data about this user
 * @param {string | string[]} _audiences - audiences to return
 * @param {Record<string, string[]>} fields - fields to return per audience
 * @returns {Promise<Record<string, Record<string, any>>>} metadata for audience / fields that were requested
 */
async function getMetadata(ctx, userId, _audiences, fields = {}) {
  const { redis } = ctx;
  const audiences = isArray(_audiences) ? _audiences : [_audiences];

  const work = [];
  const output = {};

  for (const audience of audiences) {
    const reqFields = fields[audience];
    const hasFields = isArray(reqFields) && reqFields.length > 0;
    const hashKey = redisKey(userId, USERS_METADATA, audience);
    const resp = {};
    output[audience] = resp;

    const result = hasFields
      ? partialMeta(redis, hashKey, resp, reqFields)
      : fullMeta(redis, hashKey, resp);

    work.push(result);
  }

  await Promise.all(work);

  return output;
}

module.exports = getMetadata;
module.exports.getMetadata = getMetadata;

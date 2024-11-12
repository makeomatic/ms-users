const Promise = require('bluebird');

const redisKey = require('./key');
const { USERS_METADATA, USERS_PASSWORD_FIELD } = require('../constants');
const { getInternalData } = require('./user-data');

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

/**
 * Get metadata with extended params
 *
 * @param {Microfleet} service - microfleet instance
 * @param {string} userId - retrieve data about this user
 * @param {string | string[]} audiences - audiences to return
 * @param {Object} param3 - options
 * @param {Record<string, string[]>} param3.fields - fields to return per audience
 * @param {Record<string, any>} param3.internalData - fields to return per audience
 *
 * @returns {Promise<Record<string, Record<string, any>>>} metadata for audience / fields that were requested
 */
const getExtendedMetadata = async (service, userId, audiences, {
  fields = Object.create(null),
  internalData,
} = Object.create(null)) => {
  const { config: { noPasswordCheck } } = service;

  const metadata = await getMetadata(service, userId, audiences, fields);

  if (noPasswordCheck) {
    const userInternalData = internalData || await getInternalData.call(service, userId, true);
    const noPassword = userInternalData[USERS_PASSWORD_FIELD] === undefined;

    if (noPassword) {
      metadata.noPassword = true;
    }
  }

  return metadata;
};

module.exports = getMetadata;
module.exports.getMetadata = getMetadata;
module.exports.getExtendedMetadata = getExtendedMetadata;

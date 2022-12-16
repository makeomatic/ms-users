const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const passThrough = require('lodash/identity');
const fsort = require('redis-filtered-sort');
const { ActionTransport } = require('@microfleet/plugin-router');

const handlePipeline = require('../utils/pipeline-error');
const redisKey = require('../utils/key');
const {
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_REFERRAL_INDEX,
  USERS_METADATA,
} = require('../constants');

const { redisSearchQuery } = require('../utils/redis-search-stack');

// helper
const JSONParse = (data) => JSON.parse(data);

// fetches basic ids
async function fetchIds() {
  const {
    redis,
    keys,
    args,
    keyOnly,
  } = this;

  // ensure that we have keyOnly set to true, otherwise undefined
  if (keyOnly) args.push('1');

  /**
   * args -> [criteria, order, strFilter, currentTime, offset, limit, expiration, keyOnly]
   */
  const preFilter = [...args];
  preFilter[2] = '{}';
  const result = await redis.fsort(keys, preFilter);
  if (args[2] === '{}') {
    return result;
  }

  return redis.fsort(keys, args);
}

async function redisSearchIds() {
  const {
    service,
    args,
    filter = {},
    audience,
  } = this;

  service.log.debug({ criteria: args.criteria, filter }, 'users list searching...');

  const indexMeta = service.redisSearch.getIndexMetadata(audience);
  service.log.debug('search using index: %s', indexMeta.indexName);

  const { total, ids } = await redisSearchQuery(indexMeta, this);

  service.log.info({ ids }, 'search result: %d', total);

  return [...ids, total || 0]; // generalize with 'fsort' response
}

function remapData(id, idx) {
  const data = this.userIds[idx];
  const account = {
    id,
    metadata: {
      [this.audience]: data ? mapValues(data, JSONParse) : {},
    },
  };

  return account;
}

// fetches user data
async function fetchUserData(ids) {
  const {
    service,
    redis,
    audience,
    redisSearchConfig,
    offset,
    limit,
    userIdsOnly,
  } = this;

  let dataKey = USERS_METADATA;

  if (redisSearchConfig.enabled) {
    const meta = service.redisSearch.getIndexMetadata(audience);
    dataKey = meta.filterKey;
  }

  const length = +ids.pop();

  // fetch extra data
  let userIds;
  if (length === 0 || ids.length === 0 || userIdsOnly === true) {
    userIds = null;
  } else {
    userIds = handlePipeline(await redis
      .pipeline(ids.map((id) => [
        'hgetall', redisKey(id, dataKey, audience),
      ]))
      .exec());
  }

  return {
    users: userIdsOnly === true ? ids : ids.map(remapData, { audience, userIds }),
    cursor: offset + limit,
    page: Math.floor(offset / limit) + 1,
    pages: Math.ceil(length / limit),
    total: length,
  };
}

/**
 * @api {amqp} <prefix>.list Retrieve Registered Users
 * @apiVersion 1.0.0
 * @apiName ListUsers
 * @apiGroup Users
 *
 * @apiDescription This method allows to list user that are registered and activated in the system. They can be sorted & filtered by
 * any metadata field. Furthermore, it retrieves metadata based on the supplied audience and returns array of users similar to `info`
 * endpoint
 *
 * @apiParam (Payload) {Number} [offset=0] - cursor for pagination
 * @apiParam (Payload) {Number} [limit=10] - profiles per page
 * @apiParam (Payload) {String="ASC","DESC"} [order=ASC] - sort order
 * @apiParam (Payload) {String} [criteria] - if supplied, sort will be performed based on this field
 * @apiParam (Payload) {String} audience - which namespace of metadata should be used for filtering & retrieving
 * @apiParam (Payload) {Mixed} [public=false] - when `true` returns only publicly marked users, if set to string - then uses referral index
 * @apiParam (Payload) {Object} [filter] to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified
 * @apiParam (Payload) {Boolean} [userIdsOnly=false] if set to true - will only return userIds
 */
module.exports = function iterateOverActiveUsers({ params }) {
  const {
    redis,
    config,
  } = this;

  const {
    criteria,
    audience,
    filter,
    userIdsOnly,
    expiration,
    keyOnly,
    limit = 10,
    offset = 0,
    order = 'ASC',
  } = params;

  const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
  const metaKey = redisKey('*', USERS_METADATA, audience);

  const currentTime = Date.now();

  let index;
  if (params.public === true) {
    index = USERS_PUBLIC_INDEX;
  } else if (params.public === undefined || params.public === false) {
    index = USERS_INDEX;
  } else {
    index = `${USERS_REFERRAL_INDEX}:${params.public}`;
  }

  const ctx = {
    // service parts
    redis,
    service: this,
    redisSearchConfig: config.redisSearch,

    // input parts for lua script
    keys: [
      index, metaKey,
    ],

    args: [
      criteria, order, strFilter, currentTime, offset, limit, expiration,
    ],

    // used in 2 places, hence separate args
    offset,
    limit,

    // extra settings
    filter,
    // redis search filter
    keyOnly,
    userIdsOnly,

    // extra args
    audience,
  };

  const findUserIds = ctx.redisSearchConfig.enabled ? redisSearchIds : fetchIds;

  return Promise
    .bind(ctx)
    .then(findUserIds)
    .then(keyOnly ? passThrough : fetchUserData);
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

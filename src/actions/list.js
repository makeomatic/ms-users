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

const {
  buildSearchQuery,
  normalizeFilterProp,
} = require('../utils/redis-search-stack');

// helper
const JSONParse = (data) => JSON.parse(data);

const extractUserId = (keyPrefix) => (userKey) => userKey.split('!')[0].slice(keyPrefix.length);

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

/*
without NOCONTENT format:
[
  "{ms-users}6993954371000074240!metadata!*.localhost",
 ["username", "\"Casandra_Rosenbaum@yahoo.com\"", "firstName", "\"Winnifred\"", "lastName", "\"Spinka\""],

*/
async function redisSearchIds() {
  const {
    service,
    redis,
    args: request,
    filter,
    audience,
    offset,
    limit,
  } = this;

  service.log.debug({ criteria: request.criteria, filter }, 'users list searching...');
  const { keyPrefix } = service.config.redis.options;

  const { indexName, multiWords } = service.redisSearch.getIndexMetadata(audience);

  service.log.debug('search using index: %s', indexName);
  const args = ['FT.SEARCH', indexName];

  const query = [];
  const params = [];

  for (const [propName, actionTypeOrValue] of Object.entries(filter)) {
    const prop = normalizeFilterProp(propName, actionTypeOrValue);

    if (actionTypeOrValue !== undefined) {
      const [sQuery, sParams] = buildSearchQuery(prop, actionTypeOrValue, { multiWords });

      query.push(sQuery);
      params.push(...sParams); // name, value
    }
  }

  if (query.length > 0) {
    args.push(query.join(' '));
  } else {
    args.push('*');
  }
  // TODO extract to redis aearch utils
  if (params.length > 0) {
    args.push('PARAMS', params.length.toString(), ...params);
    args.push('DIALECT', '2'); // use params dialect
  }

  // sort the response
  if (request.criteria) {
    args.push('SORTBY', request.criteria, request.order);
  } else {
    // args.push('SORTBY', FILES_ID_FIELD, request.order);
  }

  // limits
  args.push('LIMIT', offset, limit);

  // we'll fetch the data later
  args.push('NOCONTENT');

  // [total, [ids]]
  service.log.info('redis search query: %s', args.join(' '));

  const [total, ...keys] = await redis.call(...args);

  const extractId = extractUserId(keyPrefix);

  const ids = keys.map(extractId);
  service.log.info({ ids }, 'search result: %d', total);

  return ids;
}

function remapData(id, idx) {
  const data = this.props[idx];
  const account = {
    id,
    metadata: {
      [this.audience]: data ? mapValues(data, JSONParse) : {},
    },
  };

  return account;
}

// fetches user data
function fetchUserData(ids) {
  const {
    service,
    redis,
    audience,
    seachEnabled,
    offset,
    limit,
    userIdsOnly,
  } = this;

  let dataKey = USERS_METADATA;

  if (seachEnabled) {
    const meta = service.redisSearch.getIndexMetadata(audience);
    dataKey = meta.filterKey;
  }

  const total = seachEnabled ? ids.length : +ids.pop();

  // fetch extra data
  let userIds;
  if (total === 0 || ids.length === 0 || userIdsOnly === true) {
    userIds = Promise.resolve();
  } else {
    userIds = redis.pipeline()
      .addBatch(ids.map((id) => [
        'hgetall', redisKey(id, dataKey, audience),
      ]))
      .exec()
      .then(handlePipeline);
  }

  return userIds.then((props) => ({
    users: userIdsOnly === true ? ids : ids.map(remapData, { audience, props }),
    cursor: offset + limit,
    page: Math.floor(offset / limit) + 1,
    pages: Math.ceil(total / limit),
    total,
  }));
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
  switch (params.public) {
    case true:
      index = USERS_PUBLIC_INDEX;
      break;

    case undefined:
    case false:
      index = USERS_INDEX;
      break;

    default:
      index = `${USERS_REFERRAL_INDEX}:${params.public}`;
      break;
  }

  const ctx = {
    // service parts
    redis,
    seachEnabled: config.redisSearch.enabled,
    service: this,

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

  const findUserIds = ctx.seachEnabled ? redisSearchIds : fetchIds;

  return Promise
    .bind(ctx)
    .then(findUserIds)
    .then(keyOnly ? passThrough : fetchUserData);
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

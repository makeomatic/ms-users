const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const mapValues = require('lodash/mapValues');
const passThrough = require('lodash/identity');
const fsort = require('redis-filtered-sort');
const handlePipeline = require('../utils/pipelineError.js');
const {
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_REFERRAL_INDEX,
  USERS_METADATA,
} = require('../constants.js');

// helper
const JSONParse = data => JSON.parse(data);

// fetches basic ids
function fetchIds() {
  const {
    redis,

    index,
    metaKey,
    criteria,
    order,
    strFilter,
    currentTime,
    offset,
    limit,
    expiration,
    keyOnly,
  } = this;

  return redis
    .fsort(index, metaKey, criteria, order, strFilter, currentTime, offset, limit, expiration, keyOnly || undefined);
}

// fetches user data
function fetchUserData(ids) {
  const {
    redis,
    audience,
    offset,
    limit,
  } = this;

  const length = +ids.pop();

  // fetch extra data
  let userIds;
  if (length === 0 || ids.length === 0) {
    userIds = Promise.resolve([[], [], length]);
  } else {
    const pipeline = redis.pipeline();
    ids.forEach((id) => {
      pipeline.hgetall(redisKey(id, USERS_METADATA, audience));
    });
    userIds = pipeline.exec().then(handlePipeline);
  }

  return userIds.then((props) => {
    const users = ids.map(function remapData(id, idx) {
      const data = props[idx];
      const account = {
        id,
        metadata: {
          [audience]: data ? mapValues(data, JSONParse) : {},
        },
      };

      return account;
    });

    return {
      users,
      cursor: offset + limit,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(length / limit),
    };
  });
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
 * @apiParam (Payload) {Boolean} [public=false] - when `true` returns only publicly marked users
 * @apiParam (Payload) {Object} [filter] to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified
 */
function iterateOverActiveUsers({ params }) {
  const { redis } = this;
  const { criteria, audience, filter, expiration = 30000 } = params;
  const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
  const order = params.order || 'ASC';
  const offset = params.offset || 0;
  const limit = params.limit || 10;
  const keyOnly = params.keyOnly;
  const metaKey = redisKey('*', USERS_METADATA, audience);

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
    service: this,

    // input parts
    index,
    metaKey,
    criteria,
    order,
    strFilter,
    currentTime: Date.now(),
    offset,
    limit,
    expiration,
    keyOnly,

    // extra args
    audience,
  };

  return Promise
    .bind(ctx)
    .then(fetchIds)
    .tap(console.log)
    .then(keyOnly ? passThrough : fetchUserData)
    .tap(console.log);
}

module.exports = iterateOverActiveUsers;

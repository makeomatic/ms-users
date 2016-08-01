const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const mapValues = require('lodash/mapValues');
const fsort = require('redis-filtered-sort');
const { USERS_INDEX, USERS_PUBLIC_INDEX, USERS_METADATA } = require('../constants.js');

// helper
const JSONParse = data => JSON.parse(data);

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
 * @apiParam (Payload) {Object} - filter to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified
 */
function iterateOverActiveUsers(request) {
  const { redis } = this;
  const { criteria, audience, filter } = request.params;
  const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
  const order = request.params.order || 'ASC';
  const offset = request.params.offset || 0;
  const limit = request.params.limit || 10;
  const metaKey = redisKey('*', USERS_METADATA, audience);
  const index = request.params.public ? USERS_PUBLIC_INDEX : USERS_INDEX;

  return redis
    .fsort(index, metaKey, criteria, order, strFilter, offset, limit)
    .then(ids => {
      const length = +ids.pop();
      if (length === 0 || ids.length === 0) {
        return [
          ids || [],
          [],
          length,
        ];
      }

      const pipeline = redis.pipeline();
      ids.forEach(id => {
        pipeline.hgetall(redisKey(id, USERS_METADATA, audience));
      });
      return Promise.all([
        ids,
        pipeline.exec(),
        length,
      ]);
    })
    .spread((ids, props, length) => {
      const users = ids.map(function remapData(id, idx) {
        const data = props[idx][1];
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

module.exports = iterateOverActiveUsers;

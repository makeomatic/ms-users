const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const mapValues = require('lodash/mapValues');
const fsort = require('redis-filtered-sort');
const getMetadata = require('../utils/getMetadata.js');
const getInternalData = require('../utils/getInternalData.js');
const JSONParse = JSON.parse.bind(JSON);
const { USERS_INDEX, USERS_PUBLIC_INDEX, USERS_METADATA } = require('../constants.js');
const pick = require('lodash/pick');

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
module.exports = function iterateOverActiveUsers(opts) {
  const { redis } = this;
  const { criteria, audience, filter } = opts;
  const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
  const order = opts.order || 'ASC';
  const offset = opts.offset || 0;
  const limit = opts.limit || 10;
  const metaKey = redisKey('*', USERS_METADATA, audience);
  const index = opts.public ? USERS_PUBLIC_INDEX : USERS_INDEX;

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

      const internalFields = ['dateOfRegistration']

      const data = Promise.map(ids, id => {
        return Promise.all([
          getMetadata(id, audience),
          getInternalData(id).then(data => pick(data, internalFields)),
        ]);
      });

      return Promise.all([
        ids,
        data,
        length,
      ]);
    })
    .spread((ids, props, length) => {
      const users = ids.map(function remapData(id, idx) {
        const data = Object.assign({}, props[idx][0], props[idx][1]);
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
};

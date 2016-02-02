const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const mapValues = require('lodash/mapValues');
const fsort = require('redis-filtered-sort');
const JSONParse = JSON.parse.bind(JSON);
const { USERS_INDEX, USERS_METADATA } = require('../constants.js');

module.exports = function iterateOverActiveUsers(opts) {
  const { redis } = this;
  const { criteria, audience, filter } = opts;
  const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
  const order = opts.order || 'ASC';
  const offset = opts.offset || 0;
  const limit = opts.limit || 10;
  const metaKey = redisKey('*', USERS_METADATA, audience);

  return redis
    .fsort(USERS_INDEX, metaKey, criteria, order, strFilter, offset, limit)
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
        pipeline.hgetallBuffer(redisKey(id, USERS_METADATA, audience));
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
        page: Math.floor(offset / limit + 1),
        pages: Math.ceil(length / limit),
      };
    });
};

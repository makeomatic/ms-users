const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const mapValues = require('lodash/mapValues');
const { filter: transformFilter } = require('redis-filtered-sort');
const JSONParse = JSON.parse.bind(JSON);

module.exports = function iterateOverActiveUsers(opts) {
  const { redis, config } = this;
  const { criteria, audience, filter } = opts;
  const strFilter = typeof filter === 'string' ? filter : transformFilter(filter || {});
  const order = opts.order || 'ASC';
  const offset = opts.offset || 0;
  const limit = opts.limit || 10;
  const metaKey = redisKey('*', 'metadata', audience);

  return redis
    .fsort(config.redis.userSet, metaKey, criteria, order, strFilter, offset, limit)
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
        pipeline.hgetall(redisKey(id, 'metadata', audience));
        pipeline.hmget(redisKey(id, 'data'), 'active', 'ban');
      });
      return Promise.all([
        ids,
        pipeline.exec(),
        length,
      ]);
    })
    .spread((ids, props, length) => {
      const users = ids.map(function remapData(id, idx) {
        const cursor = idx * 2;
        const data = props[cursor][1];
        const accountData = props[cursor + 1][1];
        const account = {
          id,
          metadata: {
            [audience]: data ? mapValues(data, JSONParse) : {},
          },
        };

        account.metadata[audience].banned = String(accountData[1]) === 'true';
        account.metadata[audience].active = String(accountData[0]) === 'true';

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

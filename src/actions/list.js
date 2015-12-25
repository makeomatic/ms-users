const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const ld = require('lodash');

module.exports = function iterateOverActiveUsers(opts) {
  const { redis, config } = this;
  const { criteria, audience, filter } = opts;
  const strFilter = typeof filter === 'string' ? filter : JSON.stringify(filter || {});
  const order = opts.order || 'ASC';
  const offset = opts.offset || 0;
  const limit = opts.limit || 10;

  return redis
    .sortedFilteredList(config.redis.userSet, redisKey('*', 'metadata', audience), criteria, order, strFilter, offset, limit)
    .then((ids) => {
      const length = +ids.pop();
      if (length === 0 || ids.length === 0) {
        return [
          ids || [],
          [],
          length,
        ];
      }

      const pipeline = redis.pipeline();
      ids.forEach((id) => {
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
            [audience]: data ? ld.mapValues(data, JSON.parse, JSON) : {},
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

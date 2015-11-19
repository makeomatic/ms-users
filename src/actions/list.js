const Promise = require('bluebird');
const redisKey = require('../utils/key.js');

module.exports = function iterateOverActiveUsers(opts) {
  const { _redis: redis, _config: config } = this;
  const { offset, limit, order, criteria, audience, filter } = opts;

  return redis
    .sortedFilteredList(config.redis.userSet, redisKey('*', 'metadata', audience), criteria, order, filter, offset, limit)
    .then((ids) => {
      this.log.debug('Returned ids:', ids);

      const pipeline = redis.pipeline();
      ids.forEach((id) => {
        pipeline.hgetall(redisKey(id, 'metadata', audience));
      });
      return Promise.all([
        ids,
        pipeline.exec(),
      ]);
    })
    .spread((ids, props) => {
      this.log.debug('Returned props:', ids, props);

      return ids.map(function remapData(id, idx) {
        return {
          id: id,
          data: props[idx][1],
        };
      });
    });
};

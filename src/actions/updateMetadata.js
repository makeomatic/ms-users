const ld = require('lodash');
const redisKey = require('../utils/key.js');

/**
 * Updates metadata on a user object
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function updateMetadata(opts) {
  const { _redis: redis } = this;
  const { username, audience, metadata } = opts;

  const metadataKey = redisKey(username, 'metadata', audience);
  const pipeline = redis.pipeline();

  const $remove = metadata.$remove;
  if ($remove && $remove.length > 0) {
    pipeline.hdel(metadataKey, $remove);
  }

  const $set = metadata.$set;
  if ($set && Object.keys($set).length > 0) {
    pipeline.hmset(metadataKey, ld.mapValues($set, JSON.stringify, JSON));
  }

  return pipeline.exec();
};

const ld = require('lodash');
const redisKey = require('../utils/key.js');

/**
 * Updates metadata on a user object
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function updateMetadata(opts) {
  const { redis } = this;
  const { username, audience, metadata } = opts;

  const metadataKey = redisKey(username, 'metadata', audience);
  const pipeline = redis.pipeline();

  const $remove = metadata.$remove;
  const $removeOps = $remove && $remove.length || 0;
  if ($removeOps > 0) {
    pipeline.hdel(metadataKey, $remove);
  }

  const $set = metadata.$set;
  const $setKeys = $set && Object.keys($set);
  const $setLength = $setKeys && $setKeys.length || 0;
  if ($setLength > 0) {
    pipeline.hmset(metadataKey, ld.mapValues($set, JSON.stringify, JSON));
  }

  const $incr = metadata.$incr;
  const $incrFields = $incr && Object.keys($incr);
  const $incrLength = $incrFields && $incrFields.length || 0;
  if ($incrLength > 0) {
    $incrFields.forEach(fieldName => {
      pipeline.hincrby(metadataKey, fieldName, $incr[fieldName]);
    });
  }

  return pipeline
    .exec()
    .then(responses => {
      const output = {};
      let cursor = 0;

      if ($removeOps > 0) {
        output.$remove = responses[cursor][1];
        cursor++;
      }

      if ($setLength > 0) {
        output.$set = responses[cursor][1];
        cursor++;
      }

      if ($incrLength > 0) {
        const $incrResponse = output.$incr = {};
        $incrFields.forEach((fieldName, idx) => {
          $incrResponse[fieldName] = responses[cursor + idx][1];
        });
      }

      return output;
    });
};

const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const redisKey = require('../utils/key.js');
const JSONStringify = JSON.stringify.bind(JSON);
const { USERS_METADATA } = require('../constants.js');

/**
 * Process metadata update operation for a passed audience
 * @param  {Object} pipeline
 * @param  {String} audience
 * @param  {Object} metadata
 */
function handleAudience(redis, username, audience, metadata) {
  const pipeline = redis.pipeline();
  const metadataKey = redisKey(username, USERS_METADATA, audience);

  const $remove = metadata.$remove;
  const $removeOps = $remove && $remove.length || 0;
  if ($removeOps > 0) {
    pipeline.hdel(metadataKey, $remove);
  }

  const $set = metadata.$set;
  const $setKeys = $set && Object.keys($set);
  const $setLength = $setKeys && $setKeys.length || 0;
  if ($setLength > 0) {
    pipeline.hmset(metadataKey, mapValues($set, JSONStringify));
  }

  const $incr = metadata.$incr;
  const $incrFields = $incr && Object.keys($incr);
  const $incrLength = $incrFields && $incrFields.length || 0;
  if ($incrLength > 0) {
    $incrFields.forEach(fieldName => {
      pipeline.hincrby(metadataKey, fieldName, $incr[fieldName]);
    });
  }

  return { pipeline, $removeOps, $setLength, $incrLength, $incrFields };
}

/**
 * Updates metadata on a user object
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function updateMetadata(opts) {
  const { redis } = this;
  const { username } = opts;

  const audience = Array.isArray(opts.audience) ? opts.audience : [opts.audience];
  const metadata = Array.isArray(opts.metadata) ? opts.metadata : [opts.metadata];

  // process data
  const pipes = audience.map((it, idx) => (
    handleAudience(redis, username, it, metadata[idx])
  ));

  return Promise
    .map(pipes, props => props.pipeline.exec().then(responses => {
      const { $removeOps, $setLength, $incrLength, $incrFields } = props;
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
    }))
    .then(data => (
      data.length > 1 ? data : data[0]
    ));
};

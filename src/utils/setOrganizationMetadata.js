/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const is = require('is');
const { HttpStatusError } = require('common-errors');
const redisKey = require('../utils/key.js');
const handlePipeline = require('../utils/pipelineError.js');
const { ORGANIZATIONS_METADATA } = require('../constants.js');

/**
 * Process metadata update operation for a passed audience
 * @param  {Object} pipeline
 * @param  {String} audience
 * @param  {Object} metadata
 */
function handleAudience(pipeline, key, metadata) {
  const { $remove } = metadata;
  const $removeOps = $remove && $remove.length || 0;
  if ($removeOps > 0) {
    pipeline.hdel(key, $remove);
  }

  const { $set } = metadata;
  const $setKeys = $set && Object.keys($set);
  const $setLength = $setKeys && $setKeys.length || 0;
  if ($setLength > 0) {
    pipeline.hmset(key, $set);
  }

  const { $incr } = metadata;
  const $incrFields = $incr && Object.keys($incr);
  const $incrLength = $incrFields && $incrFields.length || 0;
  if ($incrLength > 0) {
    $incrFields.forEach((fieldName) => {
      pipeline.hincrby(key, fieldName, $incr[fieldName]);
    });
  }

  return {
    $removeOps, $setLength, $incrLength, $incrFields,
  };
}

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function setOrganizationMetadata(opts) {
  const { redis } = this;
  const {
    organizationId, audience, metadata,
  } = opts;
  const audiences = is.array(audience) ? audience : [audience];

  // keys
  const keys = audiences.map(aud => redisKey(organizationId, ORGANIZATIONS_METADATA, aud));

  // if we have meta, then we can
  if (metadata) {
    const pipe = redis.pipeline();
    const metaOps = is.array(metadata) ? metadata : [metadata];

    if (metaOps.length !== audiences.length) {
      return Promise.reject(new HttpStatusError(400, 'audiences must match metadata entries'));
    }

    metaOps.forEach((meta, idx) => handleAudience(pipe, keys[idx], meta));
    await pipe.exec().then(handlePipeline);
  }

  return true;
}

module.exports = setOrganizationMetadata;

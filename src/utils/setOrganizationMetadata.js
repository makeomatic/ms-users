/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const is = require('is');
const mapValues = require('lodash/mapValues');
const { HttpStatusError } = require('common-errors');
const redisKey = require('../utils/key.js');
const handlePipeline = require('../utils/pipelineError.js');
const { ORGANIZATIONS_METADATA } = require('../constants.js');

const JSONStringify = data => JSON.stringify(data);

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
    pipeline.hmset(key, mapValues($set, JSONStringify));
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
 * Maps updateMetadata ops
 * @param  {Array} responses
 * @param  {Array} operations
 * @return {Object|Array}
 */
function mapMetaResponse(operations, responses) {
  let cursor = 0;
  return Promise
    .map(operations, (props) => {
      const {
        $removeOps, $setLength, $incrLength, $incrFields,
      } = props;
      const output = {};

      if ($removeOps > 0) {
        output.$remove = responses[cursor];
        cursor += 1;
      }

      if ($setLength > 0) {
        output.$set = responses[cursor];
        cursor += 1;
      }

      if ($incrLength > 0) {
        const $incrResponse = output.$incr = {};
        $incrFields.forEach((fieldName) => {
          $incrResponse[fieldName] = responses[cursor];
          cursor += 1;
        });
      }

      return output;
    })
    .then(ops => (ops.length > 1 ? ops : ops[0]));
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

    const operations = metaOps.map((meta, idx) => handleAudience(pipe, keys[idx], meta));
    await pipe.exec()
      .then(handlePipeline)
      .then(res => mapMetaResponse(operations, res));
  }

  return true;
}

module.exports = setOrganizationMetadata;

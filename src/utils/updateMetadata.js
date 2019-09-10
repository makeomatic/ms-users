/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const is = require('is');
const { HttpStatusError } = require('common-errors');
const redisKey = require('../utils/key.js');
const sha256 = require('./sha256.js');
const handlePipeline = require('../utils/pipelineError.js');
const { USERS_METADATA } = require('../constants.js');

const JSONStringify = (data) => JSON.stringify(data);

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
    .then((ops) => (ops.length > 1 ? ops : ops[0]));
}

/**
 * Handle script, mutually exclusive with metadata
 * @param  {Array} scriptKeys
 * @param  {Array} responses
 */
function mapScriptResponse(scriptKeys, responses) {
  const output = {};
  scriptKeys.forEach((fieldName, idx) => {
    output[fieldName] = responses[idx];
  });
  return output;
}

/**
 * Updates metadata on a user object
 * @param  {Object} opts
 * @return {Promise}
 */
function updateMetadata(opts) {
  const { redis } = this;
  const {
    userId, audience, metadata, script,
  } = opts;
  const audiences = is.array(audience) ? audience : [audience];

  // keys
  const keys = audiences.map((aud) => redisKey(userId, USERS_METADATA, aud));

  // if we have meta, then we can
  if (metadata) {
    const pipe = redis.pipeline();
    const metaOps = is.array(metadata) ? metadata : [metadata];

    if (metaOps.length !== audiences.length) {
      return Promise.reject(new HttpStatusError(400, 'audiences must match metadata entries'));
    }

    const operations = metaOps.map((meta, idx) => handleAudience(pipe, keys[idx], meta));
    return pipe.exec()
      .then(handlePipeline)
      .then((res) => mapMetaResponse(operations, res));
  }

  // dynamic scripts
  const $scriptKeys = Object.keys(script);
  const scripts = $scriptKeys.map((scriptName) => {
    const { lua, argv = [] } = script[scriptName];
    const sha = sha256(lua);
    const name = `ms_users_${sha}`;
    if (!is.fn(redis[name])) {
      redis.defineCommand(name, { lua });
    }
    return redis[name](keys.length, keys, argv);
  });

  return Promise.all(scripts).then((res) => mapScriptResponse($scriptKeys, res));
}

updateMetadata.handleAudience = handleAudience;
module.exports = updateMetadata;

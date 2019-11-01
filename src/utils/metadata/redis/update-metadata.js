const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const assert = require('assert');
const { HttpStatusError } = require('common-errors');
const handlePipeline = require('../../pipeline-error');
const sha256 = require('../../sha256');
const { isRedis, isRedisPipeline } = require('../../asserts/redis');
const isNotEmptyString = require('../../asserts/string-not-empty');
const isValidId = require('../../asserts/id');

const JSONStringify = (data) => JSON.stringify(data);

/**
 * Class handling metadata update operations using Redis backend
 */
class UpdateMetadata {
  /**
   * @param {ioredis} redis or pipeline instance
   * @param metadataKeyTemplate template base for Metadata key
   */
  constructor(redis, metadataKeyBase) {
    assert(isRedis(redis), 'must be ioredis instance');
    assert(isNotEmptyString(metadataKeyBase), 'must be not empty string');
    this.redis = redis;
    this.metadataKeyBase = metadataKeyBase;
  }

  /**
   * Generates Redis key
   * Template `{id}!{metadataKeyBase}!{audience}`
   * @param {String|integer} id
   * @param {String} audience
   * @returns {String}
   */
  getMetadataKey(id, audience) {
    assert(isValidId(id), 'must be valid Id');
    assert(isNotEmptyString(audience), 'must be not empty string');
    return `${id}!${this.metadataKeyBase}!${audience}`;
  }

  /**
   * Updates metadata hash key
   * @param {String} id
   * @param {String} audience
   * @param {String} key - Hash key
   * @param {*} value
   * @param {ioredis} [redis]
   * @returns {Promise|Pipeline}
   */
  update(id, audience, key, value, redis = this.redis) {
    assert(isNotEmptyString(key), 'must be not empty string');
    assert(isRedis(redis), 'must be ioredis instance');
    assert(value, 'must not be empty');

    return redis.hset(this.getMetadataKey(id, audience), key, value);
  }

  /**
   * Updates metadata hash keys
   * @param {String} id
   * @param {String} audience
   * @param {Object} values - Object with keys and values
   * @param {ioredis} [redis]
   * @returns {Promise|Pipeline}
   */
  updateMulti(id, audience, values, redis = this.redis) {
    assert(values !== null && typeof values === 'object', 'must be an object');
    return redis.hmset(this.getMetadataKey(id, audience), values);
  }

  /**
   * Deletes metadata hash keys
   * @param {String} id
   * @param {String} audience
   * @param {String} key - Hash key
   * @param {ioredis} [redis]
   * @returns {Promise|Pipeline}
   */
  delete(id, audience, key, redis = this.redis) {
    assert(isNotEmptyString(key) || Array.isArray(key), 'must be not empty string or Array');
    assert(isRedis(redis), 'must be ioredis instance');
    return redis.hdel(this.getMetadataKey(id, audience), key);
  }

  /**
   * Updates metadata hash on provided Id
   * @param  {Object} opts
   * @return {*}
   */
  async batchUpdate(opts) {
    const { redis } = this;
    const {
      id, metadata, audience, script,
    } = opts;

    // we use own pipeline or Promise here
    assert(!isRedisPipeline(redis), 'impossible to use with pipeline');
    assert(isValidId(id), 'must be valid id');

    const audiences = Array.isArray(audience) ? audience : [audience];
    const keys = audiences.map((aud) => this.getMetadataKey(id, aud));

    // if we have meta, then we can
    if (metadata) {
      const pipe = redis.pipeline();
      const metaOps = Array.isArray(metadata) ? metadata : [metadata];

      if (metaOps.length !== audiences.length) {
        return Promise.reject(new HttpStatusError(400, 'audiences must match metadata entries'));
      }

      const operations = metaOps.map((meta, idx) => UpdateMetadata.handleAudience(pipe, keys[idx], meta));
      const result = handlePipeline(await pipe.exec());

      return UpdateMetadata.mapMetaResponse(operations, result);
    }

    // dynamic scripts
    const $scriptKeys = Object.keys(script);
    const scripts = $scriptKeys.map((scriptName) => {
      const { lua, argv = [] } = script[scriptName];
      const sha = sha256(lua);
      const name = `ms_users_${sha}`;
      if (typeof redis[name] !== 'function') {
        redis.defineCommand(name, { lua });
      }
      return redis[name](keys.length, keys, argv);
    });

    const result = await Promise.all(scripts);

    return UpdateMetadata.mapScriptResponse($scriptKeys, result);
  }

  /**
   * Process metadata update operation for a passed audience
   * @param  {Object} pipeline
   * @param  {String} audience
   * @param  {Object} metadata
   */
  static handleAudience(pipeline, key, metadata) {
    const { $remove } = metadata;
    const $removeOps = $remove ? $remove.length : 0;
    if ($removeOps > 0) {
      pipeline.hdel(key, $remove);
    }

    const { $set } = metadata;
    const $setKeys = $set && Object.keys($set);
    const $setLength = $setKeys ? $setKeys.length : 0;
    if ($setLength > 0) {
      pipeline.hmset(key, mapValues($set, JSONStringify));
    }

    const { $incr } = metadata;
    const $incrFields = $incr && Object.keys($incr);
    const $incrLength = $incrFields ? $incrFields.length : 0;
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
  static mapMetaResponse(operations, responses) {
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
  static mapScriptResponse(scriptKeys, responses) {
    const output = {};
    scriptKeys.forEach((fieldName, idx) => {
      output[fieldName] = responses[idx];
    });
    return output;
  }
}

module.exports = UpdateMetadata;

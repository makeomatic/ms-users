const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const assert = require('assert');
const { Pipeline } = require('ioredis');
const { HttpStatusError } = require('common-errors');
const handlePipeline = require('../../pipelineError');
const sha256 = require('../../sha256');

const JSONStringify = (data) => JSON.stringify(data);

/**
 * Class wraps User/Organization metadata update using atomic LUA script
 */
class UpdateMetadata {
  /**
   * @param redis
   * @param metadataKeyTemplate
   * @param audienceKeyTemplate
   */
  constructor(redis, metadataKeyBase) {
    this.redis = redis;
    this.metadataKeyBase = metadataKeyBase;
  }

  getMetadataKey(id, audience) {
    return `${id}!${this.metadataKeyBase}!${audience}`;
  }

  update(id, audience, key, value, redis = this.redis) {
    return redis.hset(this.getMetadataKey(id, audience), key, value);
  }

  updateMulti(id, audience, values, redis = this.redis) {
    return redis.hmset(this.getMetadataKey(id, audience), values);
  }

  delete(id, audience, key, redis = this.redis) {
    return redis.hdel(this.getMetadataKey(id, audience), key);
  }

  /**
   * Updates metadata on a user object
   * @param  {Object} opts
   * @return {Promise}
   */
  async batchUpdate(opts) {
    const { redis } = this;
    assert(!(redis instanceof Pipeline), 'impossible to use with pipeline');
    const {
      id, audience, metadata, script,
    } = opts;
    const audiences = Array.isArray(audience) ? audience : [audience];

    // keys
    const keys = audiences.map((aud) => this.getMetadataKey(id, aud));

    // if we have meta, then we can
    if (metadata) {
      const pipe = redis.pipeline();
      const metaOps = Array.isArray(metadata) ? metadata : [metadata];

      if (metaOps.length !== audiences.length) {
        return Promise.reject(new HttpStatusError(400, 'audiences must match metadata entries'));
      }

      const operations = metaOps.map((meta, idx) => UpdateMetadata.handleAudience(pipe, keys[idx], meta));
      return pipe.exec()
        .then(handlePipeline)
        .then((res) => UpdateMetadata.mapMetaResponse(operations, res));
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

    return Promise.all(scripts).then((res) => UpdateMetadata.mapScriptResponse($scriptKeys, res));
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

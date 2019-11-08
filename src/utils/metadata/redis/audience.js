const assert = require('assert');
const { isRedis } = require('../../asserts/redis');
const isNotEmptyString = require('../../asserts/string-not-empty');
const isValidId = require('../../asserts/id');

/**
 * Class handling Audience tracking using Redis backend
 */
class Audience {
  /**
   * @param {ioredis|Pipeline} redis
   * @param {string} audienceKeyBase
   */
  constructor(redis, audienceKeyBase) {
    assert(isRedis(redis), 'must be ioredis instance');
    assert(isNotEmptyString(audienceKeyBase), 'must be not empty string');
    this.redis = redis;
    this.audienceKeyBase = audienceKeyBase;
  }

  /**
   * Generates Redis key
   * Template `{id}!{metadataKeyBase}`
   * @param {String|Number} id
   * @returns {string}
   */
  getAudienceKey(id) {
    assert(isValidId(id), 'must be valid Id');
    return `${id}!${this.audienceKeyBase}`;
  }

  /**
   * Adds audience
   * @param {String|Number} id
   * @param {String|Array} audience
   * @param {ioredis|Pipeline} [redis]
   * @returns {Promise|Pipeline}
   */
  add(id, audience, redis = this.redis) {
    assert(isRedis(redis), 'must be ioredis instance');
    assert(isNotEmptyString(audience) || Array.isArray(audience), 'must be not empty string or Array');
    return redis.sadd(this.getAudienceKey(id), audience);
  }

  /**
   * Deletes audience
   * @param {String|Number} id
   * @param {String} audience
   * @param {ioredis|Pipeline} [redis]
   * @returns {Promise|Pipeline}
   */
  delete(id, audience, redis = this.redis) {
    assert(isRedis(redis), 'must be ioredis instance');
    assert(isNotEmptyString(audience) || Array.isArray(audience), 'must be not empty string or Array');
    return redis.srem(this.getAudienceKey(id), audience);
  }

  /**
   * Get list of assigned audiences
   * @param {String|Number} id
   * @param {ioredis|Pipeline}redis
   * @returns {Promise|Pipeline}
   */
  get(id, redis = this.redis) {
    return redis.smembers(this.getAudienceKey(id));
  }

  /**
   * Synchronizes audience list with currently available metadata
   * @param id
   * @param metadataKeyTemplate - format '{{ID}}!yourMetadataClass!{{AUDIENCE}}'
   * @param redis
   * @returns {*}
   */
  resyncSet(id, metadataKeyTemplate, redis = this.redis) {
    assert(isRedis(this.redis), 'must be ioredis instance');
    assert(isNotEmptyString(metadataKeyTemplate), 'must be not empty string');
    const luaScript = `
      local audiences = redis.call("SMEMBERS", KEYS[1])
      for _, audience in pairs(audiences) do
        local metaKey = string.gsub(KEYS[2], '{{AUDIENCE}}', audience)
        local keyLen = redis.call("HLEN", metaKey)
        if (keyLen < 1) then
          redis.call('SREM', KEYS[1], audience)
        end
      end
    `;
    return redis.eval(luaScript, 2, this.getAudienceKey(id), metadataKeyTemplate);
  }
}

module.exports = Audience;

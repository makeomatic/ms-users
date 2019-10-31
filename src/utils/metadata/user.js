const Promise = require('bluebird');
const { Pipeline } = require('ioredis');
const MetaUpdate = require('./redis/update-metadata');
const Audience = require('./redis/audience');

const { USERS_METADATA, USERS_AUDIENCE } = require('../../constants');

/**
 * Class handles User metadata operations
 */
class UserMetadata {
  /**
   * @param {ioredis|Pipeline} redis
   */
  constructor(redis) {
    this.pipeline = redis instanceof Pipeline;
    this.redis = redis;
    this.metadata = new MetaUpdate(this.redis, USERS_METADATA);
    this.audience = new Audience(this.redis, USERS_AUDIENCE);
  }

  /**
   * Updates metadata field on a user object
   * @param {String|Number} id
   * @param {Object} values
   * @param {String} audience
   * @returns {Promise|void}
   */
  update(id, hashKey, value, audience) {
    const work = [
      this.audience.add(id, audience),
      this.metadata.update(id, audience, hashKey, value),
    ];
    return this.pipeline ? Promise.all(work) : work;
  }

  /**
   * Updates metadata on a user object using fields and values from provided Object
   * @param {String|Number} id
   * @param {Object} values
   * @param {String} audience
   * @returns {Promise|void}
   */
  updateMulti(id, values, audience) {
    const work = [
      this.audience.add(id, audience),
      this.metadata.updateMulti(id, audience, values),
    ];
    return this.pipeline ? Promise.all(work) : work;
  }

  /**
   * Deletes key from user metadata object
   * @param {String|Number} id
   * @param {String} hashKey
   * @param {String} audience
   * @returns {Promise|void}
   */
  delete(id, hashKey, audience) {
    return this.metadata.delete(id, audience, hashKey);
  }

  /**
   * Updates metadata on a user object using batch operations
   * @param  {Object} opts
   * @return {Promise}
   */
  async batchUpdate(opts) {
    const { userId, ...restOpts } = opts;
    await this.audience.add(userId, restOpts.audience);
    return this.metadata.batchUpdate({ id: userId, ...restOpts });
  }
}

module.exports = UserMetadata;

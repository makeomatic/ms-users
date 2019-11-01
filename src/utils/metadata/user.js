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
   * @param {String|Number} userId
   * @param {Staing|Array} audience
   */
  constructor(redis, userId, audience) {
    this.pipeline = redis instanceof Pipeline;
    this.redis = redis;
    this.userAudience = audience;
    this.userId = userId;
    this.metadata = new MetaUpdate(this.redis, USERS_METADATA);
    this.audience = new Audience(this.redis, USERS_AUDIENCE);
  }

  /**
   * Updates metadata field on a user object
   * @param {Object} values
   * @param {String} [audience]
   * @returns {Promise|void}
   */
  update(hashKey, value, audience = this.userAudience) {
    const work = [
      this.audience.add(this.userId, audience),
      this.metadata.update(this.userId, audience, hashKey, value),
    ];
    return this.pipeline ? work : Promise.all(work);
  }

  /**
   * Updates metadata on a user object using fields and values from provided Object
   * @param {Object} values
   * @param {String} [audience]
   * @returns {Promise|void}
   */
  updateMulti(values, audience = this.userAudience) {
    const work = [
      this.audience.add(this.userId, audience),
      this.metadata.updateMulti(this.userId, audience, values),
    ];
    return this.pipeline ? work : Promise.all(work);
  }

  /**
   * Deletes key from user metadata object
   * @param {String|Number} id
   * @param {String} hashKey
   * @param {String} [audience]
   * @returns {Promise|void}
   */
  delete(hashKey, audience = this.userAudience) {
    return this.pipeline ? this.deletePipeline(hashKey, audience) : this.deleteAsync(hashKey, audience);
  }

  deletePipeline(hashKey, audience) {
    this.metadata.delete(this.userId, audience, hashKey);
    return this.syncAudience();
  }

  async deleteAsync(hashKey, audience) {
    const result = await this.metadata.delete(this.userId, audience, hashKey);
    await this.syncAudience();
    return result;
  }

  async syncAudience() {
    const metaKeyTemplate = this.metadata.getMetadataKey('{{ID}}', '{{AUDIENCE}}');
    return this.audience.resyncSet(this.userId, metaKeyTemplate);
  }

  /**
   * Updates metadata on a user object using batch operations
   * @param  {Object} opts
   * @return {Promise}
   */
  async batchUpdate(opts) {
    await this.audience.add(this.userId, this.userAudience);
    const updateResult = await this.metadata
      .batchUpdate({
        id: this.userId,
        audience: this.userAudience,
        ...opts,
      });
    await this.syncAudience();
    return updateResult;
  }

  static using(userId, audience, redis) {
    return new UserMetadata(redis, userId, audience);
  }
}

module.exports = UserMetadata;

const Promise = require('bluebird');
const { Pipeline } = require('ioredis');
const MetaUpdate = require('./redis/update-metadata');
const Audience = require('./redis/audience');

const { USERS_METADATA, USERS_AUDIENCE } = require('../../constants');

class User {
  constructor(redis) {
    this.pipeline = redis instanceof Pipeline;
    this.redis = redis;
    this.metadata = new MetaUpdate(this.redis, USERS_METADATA);
    this.audience = new Audience(this.redis, USERS_AUDIENCE);
  }

  /**
   *
   * @param id - User id
   * @param hashKey - Key in metadata
   * @param value
   * @param audience
   * @returns {Promise<void>}
   */
  update(id, hashKey, value, audience) {
    const work = [
      this.audience.add(id, audience),
      this.metadata.update(id, audience, hashKey, value),
    ];
    return this.pipeline ? Promise.all(work) : work;
  }

  updateMulti(id, values, audience) {
    const work = [
      this.audience.add(id, audience),
      this.metadata.updateMulti(id, audience, values),
    ];
    return this.pipeline ? Promise.all(work) : work;
  }

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
    const audienceWork = this.audience.batchAdd(userId, restOpts.audience);

    await Promise.all(audienceWork);
    return this.metadata.batchUpdate({ id: userId, ...restOpts });
  }
}

module.exports = User;

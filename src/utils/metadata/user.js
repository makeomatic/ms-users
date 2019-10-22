const redisKey = require('../key');

const MetaUpdate = require('./redis/update-metadata');
const { USERS_METADATA, USERS_AUDIENCE } = require('../../constants');

class User {
  constructor(redis) {
    this.redis = redis;
    const audienceKeyTemplate = redisKey('{id}', USERS_AUDIENCE);
    const metaDataTemplate = redisKey('{id}', USERS_METADATA, '{audience}');
    this.metaUpdater = new MetaUpdate(this.redis, metaDataTemplate, audienceKeyTemplate);
  }

  /**
   * Updates metadata on a user object
   * @param  {Object} opts
   * @return {Promise}
   */
  update(opts) {
    const { userId, ...restOpts } = opts;
    return this.metaUpdater.update({ id: userId, ...restOpts });
  }
}

module.exports = User;

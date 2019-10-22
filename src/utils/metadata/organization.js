const redisKey = require('../key');

const MetaUpdate = require('./redis/update-metadata');
const { ORGANIZATIONS_METADATA, ORGANIZATIONS_AUDIENCE } = require('../../constants');

class Organization {
  constructor(redis) {
    this.redis = redis;
    const audienceKeyTemplate = redisKey('{id}', ORGANIZATIONS_AUDIENCE);
    const metaDataTemplate = redisKey('{id}', ORGANIZATIONS_METADATA, '{audience}');
    this.metaUpdater = new MetaUpdate(this.redis, metaDataTemplate, audienceKeyTemplate);
  }

  /**
   * Updates metadata on a organization object
   * @param  {Object} opts
   * @return {Promise}
   */
  update(opts) {
    const { organizationId, ...restOpts } = opts;
    return this.metaUpdater.update({ id: organizationId, ...restOpts });
  }
}

module.exports = Organization;

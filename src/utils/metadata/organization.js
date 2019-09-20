const Promise = require('bluebird');
const Audience = require('./redis/audience');
const MetaUpdate = require('./redis/update-metadata');
const { ORGANIZATIONS_METADATA, ORGANIZATIONS_AUDIENCE } = require('../../constants');

class Organization {
  constructor(redis) {
    this.redis = redis;
    this.meta = new MetaUpdate(this.redis, ORGANIZATIONS_METADATA);
    this.audience = new Audience(this.redis, ORGANIZATIONS_AUDIENCE);
  }

  /**
   * Updates metadata on a organization object
   * @param  {Object} opts
   * @return {Promise}
   */
  async batchUpdate(opts) {
    const { organizationId, ...restOpts } = opts;
    const audienceWork = this.audience.batchAdd(organizationId, restOpts.audience);

    await Promise.all(audienceWork);
    return this.meta.batchUpdate({ id: organizationId, ...restOpts });
  }
}

module.exports = Organization;

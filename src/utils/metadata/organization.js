const Audience = require('./redis/audience');
const MetaUpdate = require('./redis/update-metadata');
const { ORGANIZATIONS_METADATA, ORGANIZATIONS_AUDIENCE } = require('../../constants');

/**
 * Class handling Organization Metadata operations
 */
class OrganizationMetadata {
  /**
   * @param {ioredis|Pipeline} redis
   */
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
    await this.audience.add(organizationId, restOpts.audience);
    return this.meta.batchUpdate({ id: organizationId, ...restOpts });
  }
}

module.exports = OrganizationMetadata;

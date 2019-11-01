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
    this.metadata = new MetaUpdate(this.redis, ORGANIZATIONS_METADATA);
    this.audience = new Audience(this.redis, ORGANIZATIONS_AUDIENCE);
  }

  async syncAudience(organizationId) {
    const metaKeyTemplate = this.metadata.getMetadataKey('{{ID}}', '{{AUDIENCE}}');
    return this.audience.resyncSet(organizationId, metaKeyTemplate);
  }

  /**
   * Updates metadata on a organization object
   * @param  {Object} opts
   * @return {Promise}
   */
  async batchUpdate(opts) {
    const { organizationId, ...restOpts } = opts;
    await this.audience.add(organizationId, restOpts.audience);
    const updateResult = await this.metadata
      .batchUpdate({
        id: organizationId,
        ...opts,
      });
    await this.syncAudience(organizationId);
    return updateResult;
  }
}

module.exports = OrganizationMetadata;

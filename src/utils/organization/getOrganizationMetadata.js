const { ORGANIZATIONS_METADATA } = require('../../constants');
const redisKey = require('../key');

async function getOrganizationMetadata(organizationId) {
  const { redis, config } = this;
  const { audience } = config.organizations;

  return redis.hgetall(redisKey(organizationId, ORGANIZATIONS_METADATA, audience));
}

module.exports = getOrganizationMetadata;

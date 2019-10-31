const mapValues = require('lodash/mapValues');
const { ORGANIZATIONS_METADATA } = require('../../constants');
const redisKey = require('../key');
const JSONParse = require('../safe-parse');

async function getOrganizationMetadata(organizationId, audience) {
  const { redis, config } = this;
  const { audience: defaultAudience } = config.organizations;

  const metadata = await redis.hgetall(redisKey(organizationId, ORGANIZATIONS_METADATA, audience || defaultAudience));
  return mapValues(metadata, JSONParse);
}

module.exports = getOrganizationMetadata;

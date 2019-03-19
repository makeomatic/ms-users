const mapValues = require('lodash/mapValues');
const { ORGANIZATIONS_METADATA } = require('../../constants');
const redisKey = require('../key');
const JSONParse = require('../safeParse');

async function getOrganizationMetadata(organizationId) {
  const { redis, config } = this;
  const { audience } = config.organizations;

  const metadata = await redis.hgetall(redisKey(organizationId, ORGANIZATIONS_METADATA, audience));
  return mapValues(metadata, JSONParse);
}

module.exports = getOrganizationMetadata;

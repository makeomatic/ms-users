const Promise = require('bluebird');
const { ORGANIZATIONS_METADATA, ORGANIZATIONS_MEMBERS } = require('../../constants');
const getInternalData = require('./getInternalData');
const redisKey = require('../key');

async function getOrganizationMetadataAndMembers(organizationId) {
  const { redis, config } = this;
  const { audience } = config.organizations;
  const organization = await getInternalData.call(this, organizationId, true);
  const metadata = await redis.hgetall(redisKey(organizationId, ORGANIZATIONS_METADATA, audience));
  const organizationMembersIds = await redis.zscan(redisKey(organizationId, ORGANIZATIONS_MEMBERS), 0);
  let organizationMembersJobs = [];
  if (organizationMembersIds) {
    organizationMembersJobs = organizationMembersIds[1].reduce((acc, memberId, index) => {
      if (index === 0 || index % 2 === 0) {
        acc.push(redis.hgetall(memberId));
      }

      return acc;
    }, []);
  }
  const members = await Promise.all(organizationMembersJobs);

  return {
    ...organization,
    metadata,
    members,
  };
}

module.exports = getOrganizationMetadataAndMembers;

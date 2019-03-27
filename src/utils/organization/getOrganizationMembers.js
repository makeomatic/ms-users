const Promise = require('bluebird');
const { ORGANIZATIONS_MEMBERS } = require('../../constants');
const redisKey = require('../key');

async function getOrganizationMembers(organizationId) {
  const { redis } = this;
  const organizationMembersIds = await redis.zrange(redisKey(organizationId, ORGANIZATIONS_MEMBERS), 0, -1);
  let organizationMembersJobs = [];
  if (organizationMembersIds) {
    organizationMembersJobs = organizationMembersIds.map(organizationMemberId => redis.hgetall(organizationMemberId));
  }

  return Promise.all(organizationMembersJobs);
}

module.exports = getOrganizationMembers;

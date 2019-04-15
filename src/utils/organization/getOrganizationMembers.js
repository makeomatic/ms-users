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

  const members = await Promise.all(organizationMembersJobs);

  return members.map(member => ({
    ...member,
    permissions: member.permissions === '' ? [] : member.permissions.split(','),
  }));
}

module.exports = getOrganizationMembers;

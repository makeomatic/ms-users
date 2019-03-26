const Promise = require('bluebird');
const { ORGANIZATIONS_MEMBERS } = require('../../constants');
const redisKey = require('../key');

async function getOrganizationMembers(organizationId) {
  const { redis } = this;
  const organizationMembersIds = await redis.zrange(redisKey(organizationId, ORGANIZATIONS_MEMBERS), 0, -1);
  let organizationMembersJobs = [];
  if (organizationMembersIds) {
    organizationMembersJobs = organizationMembersIds[1].reduce((acc, memberId, index) => {
      if (index === 0 || index % 2 === 0) {
        acc.push(redis.hgetall(memberId));
      }

      return acc;
    }, []);
  }

  return Promise.all(organizationMembersJobs);
}

module.exports = getOrganizationMembers;

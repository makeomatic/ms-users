/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const redisKey = require('../key.js');
const handlePipeline = require('../pipelineError.js');
const { ORGANIZATIONS_MEMBERS, ErrorUserNotFound, USERS_ORGANIZATIONS } = require('../../constants.js');
const { getUserId } = require('../userData/index');

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function addOrganizationMembers(opts) {
  const { redis } = this;
  const { organizationId, members, organizationName } = opts;

  const membersIdsJob = members.map(member => Promise
    .bind(this, member.username)
    .then(getUserId)
    .catch(ErrorUserNotFound));
  const membersIds = await Promise.all(membersIdsJob);

  // if we have meta, then we can
  if (members) {
    const pipe = redis.pipeline();

    const membersKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
    members.forEach((member, idx) => {
      member.id = membersIds[idx];
      const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, member.id);
      const memberOrganizations = redisKey(member.id, USERS_ORGANIZATIONS);
      member.invited = Date.now();
      member.accepted = null;
      member.permissions = member.permissions || [];
      pipe.hmset(memberKey, member);
      pipe.hset(memberOrganizations, organizationName, JSON.stringify(member.permissions));
      pipe.zadd(membersKey, Date.now(), memberKey);
    });

    await pipe.exec().then(handlePipeline);
  }

  return true;
}

module.exports = addOrganizationMembers;

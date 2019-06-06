/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const redisKey = require('../key.js');
const sendInviteMail = require('./sendInviteMail');
const getInternalData = require('./getInternalData');
const handlePipeline = require('../pipelineError.js');
const { ORGANIZATIONS_MEMBERS, USERS_ORGANIZATIONS, ORGANIZATIONS_NAME_FIELD } = require('../../constants.js');

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function addOrganizationMembers(opts) {
  const { redis } = this;
  const { organizationId, members } = opts;

  const pipe = redis.pipeline();
  const membersKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
  members.forEach((member) => {
    const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, member.email);
    const memberOrganizations = redisKey(member.email, USERS_ORGANIZATIONS);
    member.username = member.email;
    member.invited = Date.now();
    member.accepted = null;
    member.permissions = member.permissions || [];
    pipe.hmset(memberKey, member);
    pipe.hset(memberOrganizations, organizationId, JSON.stringify(member.permissions));
    pipe.zadd(membersKey, member.invited, memberKey);
  });

  await pipe.exec().then(handlePipeline);
  const organization = await getInternalData.call(this, organizationId, false);

  const membersIdsJob = [];
  for (const member of members) {
    membersIdsJob.push(
      sendInviteMail.call(this, {
        email: member.email,
        ctx: {
          firstName: member.firstName,
          lastName: member.lastName,
          organization: organization[ORGANIZATIONS_NAME_FIELD],
        },
      })
    );
  }

  return Promise.all(membersIdsJob);
}

module.exports = addOrganizationMembers;

/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const redisKey = require('../key.js');
const getUserId = require('../userData/getUserId');
const sendInviteMail = require('./sendInviteMail');
const getInternalData = require('./getInternalData');
const registerOrganizationMembers = require('./registerOrganizationMembers');
const handlePipeline = require('../pipelineError.js');
const {
  ORGANIZATIONS_MEMBERS,
  USERS_ORGANIZATIONS,
  ORGANIZATIONS_NAME_FIELD,
  USERS_ACTION_ORGANIZATION_INVITE,
  USERS_ACTION_ORGANIZATION_REGISTER,
  ORGANIZATIONS_ID_FIELD,
} = require('../../constants.js');

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function addOrganizationMembers(opts) {
  const { redis } = this;
  const { organizationId, members } = opts;

  const registeredMembers = [];
  const notRegisteredMembers = [];

  const filterMembersJob = members.map(async (member) => {
    try {
      const userId = await getUserId.call(this, member.email);
      registeredMembers.push({ ...member, id: userId });
    } catch (e) {
      notRegisteredMembers.push(member);
    }
  });
  await Promise.all(filterMembersJob);

  const createdMembers = await registerOrganizationMembers.call(this, notRegisteredMembers);

  const pipe = redis.pipeline();
  const membersKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
  const organizationMembers = registeredMembers.concat(createdMembers);
  organizationMembers.forEach(({ password, ...member }) => {
    const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, member.email);
    const memberOrganizations = redisKey(member.email, USERS_ORGANIZATIONS);
    member.username = member.email;
    member.invited = Date.now();
    member.accepted = password ? Date.now() : null;
    member.permissions = member.permissions || [];
    pipe.hmset(memberKey, member);
    pipe.hset(memberOrganizations, organizationId, JSON.stringify(member.permissions));
    pipe.zadd(membersKey, member.invited, memberKey);
  });

  await pipe.exec().then(handlePipeline);
  const organization = await getInternalData.call(this, organizationId);

  const membersIdsJob = [];
  for (const member of organizationMembers) {
    membersIdsJob.push(
      sendInviteMail.call(this, {
        email: member.email,
        action: member.password ? USERS_ACTION_ORGANIZATION_REGISTER : USERS_ACTION_ORGANIZATION_INVITE,
        ctx: {
          firstName: member.firstName,
          lastName: member.lastName,
          password: member.password,
          email: member.email,
          organizationId: organization[ORGANIZATIONS_ID_FIELD],
          organization: organization[ORGANIZATIONS_NAME_FIELD],
        },
      })
    );
  }

  return Promise.all(membersIdsJob);
}

module.exports = addOrganizationMembers;

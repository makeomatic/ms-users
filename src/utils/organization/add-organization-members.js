/* eslint-disable no-mixed-operators */
const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const redisKey = require('../key.js');
const getUserId = require('../userData/get-user-id');
const sendInviteMail = require('./send-invite-email');
const getInternalData = require('./get-internal-data');
const registerOrganizationMembers = require('./register-organization-members');
const handlePipeline = require('../pipeline-error');
const UserMetadata = require('../metadata/user');

const {
  ORGANIZATIONS_MEMBERS,
  ORGANIZATIONS_NAME_FIELD,
  USERS_ACTION_ORGANIZATION_INVITE,
  USERS_ACTION_ORGANIZATION_REGISTER,
  ORGANIZATIONS_ID_FIELD,
} = require('../../constants.js');

const JSONStringify = (data) => JSON.stringify(data);

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function addOrganizationMembers(opts) {
  const { redis } = this;
  const { organizationId, members, audience } = opts;

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
    const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, member.id);
    member.username = member.email;
    member.invited = Date.now();
    member.accepted = password ? Date.now() : null;
    member.permissions = member.permissions || [];
    const stringifyMember = mapValues(member, JSONStringify);
    pipe.hmset(memberKey, stringifyMember);
    UserMetadata
      .using(member.id, audience, pipe)
      .update(organizationId, stringifyMember.permissions);
    pipe.zadd(membersKey, stringifyMember.invited, memberKey);
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

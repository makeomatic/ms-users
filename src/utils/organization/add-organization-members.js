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
  ORGANIZATIONS_ID_FIELD,
  USERS_ACTION_ORGANIZATION_REGISTER,
  USERS_ACTION_ORGANIZATION_ADD,
} = require('../../constants.js');
const generateEmail = require('../challenges/email/generate.js');

const JSONStringify = (data) => JSON.stringify(data);

async function distributeUsersByExist(user) {
  try {
    const userId = await getUserId.call(this, user.email);
    this.registeredMembers.push({ ...user, id: userId });
  } catch (e) {
    this.notRegisteredMembers.push(user);
  }
}

async function addMember({ password, ...member }) {
  const { organizationId, audience, pipe, membersKey } = this;

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
}

async function sendInvite(member) {
  const ctx = {
    email: member.email,
    firstName: member.firstName,
    lastName: member.lastName,
    password: member.password,
    permissions: member.permissions,
    organizationId: this.organization[ORGANIZATIONS_ID_FIELD],
    organization: this.organization[ORGANIZATIONS_NAME_FIELD],
  };

  if (ctx.password) {
    return sendInviteMail.call(this, { ctx, email: member.email }, USERS_ACTION_ORGANIZATION_REGISTER);
  }

  // if user already exist, just send info email, about new org
  const res = await generateEmail.call(this, member.email, USERS_ACTION_ORGANIZATION_ADD, ctx, { wait: true, send: true });

  if (res.err) {
    this.log.error(res, 'send organization add mail result');
  }

  return res;
}

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @param  {Boolean} sendInviteFlag
 * @return {Promise}
 */
async function addOrganizationMembers({ organizationId, members, audience }, sendInviteFlag = false) {
  const { redis } = this;

  const registeredMembers = [];
  const notRegisteredMembers = [];
  const filterMembersJob = members.map(distributeUsersByExist, { ...this, registeredMembers, notRegisteredMembers });
  await Promise.all(filterMembersJob);

  // Create non exist users and concat with already registered
  const createdMembers = await registerOrganizationMembers.call(this, notRegisteredMembers);
  const organizationMembers = registeredMembers.concat(createdMembers);

  // Add members to organization through pipeline
  const membersKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
  const pipe = redis.pipeline();
  organizationMembers.forEach(addMember, { organizationId, audience, pipe, membersKey });
  await pipe.exec().then(handlePipeline);

  if (sendInviteFlag) {
    // Send invites
    const organization = await getInternalData.call(this, organizationId);
    const membersIdsJob = organizationMembers.map(sendInvite, { ...this, organization });

    await Promise.all(membersIdsJob);
  }
}

module.exports = addOrganizationMembers;

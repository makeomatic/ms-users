const { ActionTransport } = require('@microfleet/plugin-router');

const redisKey = require('../../../utils/key');
const getUserId = require('../../../utils/userData/get-user-id');
const { getMemberData } = require('../../../utils/organization/get-organization-members');
const { checkOrganizationExists } = require('../../../utils/organization');
const { isMFAEnabled } = require('../../../utils/mfa');
const {
  ORGANIZATIONS_MEMBERS,
  USERS_METADATA,
  ErrorUserNotMember,
} = require('../../../constants');

/**
 * @api {amqp} <prefix>.members.Get Get organization member
 * @apiVersion 1.0.0
 * @apiName members.get
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to get member.
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {String} username - member email.
 */
async function getMember({ params }) {
  const { redis, config } = this;
  const { organizationId, username } = params;
  const { audience, showMfa } = config.organizations;

  const userId = await getUserId.call(this, username);
  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId);
  const memberMetadataKey = redisKey(userId, USERS_METADATA, audience);
  const userInOrganization = await redis.hget(memberMetadataKey, organizationId);
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  const userDataCalls = [getMemberData.call(this, memberKey)];
  if (showMfa) {
    userDataCalls.push(isMFAEnabled.call(this, userId));
  }

  const [member, mfaEnabled] = await Promise.all(userDataCalls);
  if (showMfa) {
    member.mfaEnabled = mfaEnabled;
  }

  return {
    data: {
      id: member.id,
      type: 'organizationMember',
      attributes: member,
    },
  };
}

getMember.allowed = checkOrganizationExists;
getMember.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = getMember;

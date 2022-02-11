const { ActionTransport } = require('@microfleet/plugin-router');

const redisKey = require('../../../utils/key');
const getUserId = require('../../../utils/userData/get-user-id');
const updateMember = require('../../../utils/organization/update-organization-members');
const { checkOrganizationExists } = require('../../../utils/organization');
const { getMemberData } = require('../../../utils/organization/get-organization-members');
const {
  ORGANIZATIONS_MEMBERS,
  USERS_METADATA,
  ErrorUserNotMember,
} = require('../../../constants');

/**
 * @api {amqp} <prefix>.members.update Update organization member
 * @apiVersion 1.0.0
 * @apiName members.update
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to update member.
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {String} username - member email.
 * @apiParam (Payload) {Object[]} [data] - supports `$set key:value`, `$remove keys[]`
 */
async function updateMemberData({ params }) {
  const { redis, config } = this;
  const { organizationId, username, data } = params;
  const { audience } = config.organizations;

  const userId = await getUserId.call(this, username);
  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId);
  const memberMetadataKey = redisKey(userId, USERS_METADATA, audience);
  const userInOrganization = await redis.hget(memberMetadataKey, organizationId);

  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  await updateMember.call(this, memberKey, data);
  const member = await getMemberData.call(this, memberKey);

  return {
    data: {
      attributes: member,
    },
  };
}

updateMemberData.allowed = checkOrganizationExists;
updateMemberData.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = updateMemberData;

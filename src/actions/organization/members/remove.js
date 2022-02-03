const { ActionTransport } = require('../../../re-export');

const redisKey = require('../../../utils/key');
const getUserId = require('../../../utils/userData/get-user-id');
const handlePipeline = require('../../../utils/pipeline-error');
const { checkOrganizationExists } = require('../../../utils/organization');
const {
  ORGANIZATIONS_MEMBERS,
  USERS_METADATA,
  ErrorUserNotMember,
} = require('../../../constants');

/**
 * @api {amqp} <prefix>.members.remove Remove organization member
 * @apiVersion 1.0.0
 * @apiName members.remove
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to remove member.
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {String} username - member email.
 */
async function removeMember({ params }) {
  const { redis, config } = this;
  const { organizationId, username } = params;
  const { audience } = config.organizations;

  const userId = await getUserId.call(this, username);
  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId);
  const memberMetadataKey = redisKey(userId, USERS_METADATA, audience);
  const userInOrganization = await redis.hget(memberMetadataKey, organizationId);
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  const pipeline = redis.pipeline();
  pipeline.del(memberKey);
  pipeline.zrem(redisKey(organizationId, ORGANIZATIONS_MEMBERS), memberKey);
  pipeline.hdel(memberMetadataKey, organizationId);

  return pipeline.exec().then(handlePipeline);
}

removeMember.allowed = checkOrganizationExists;
removeMember.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = removeMember;

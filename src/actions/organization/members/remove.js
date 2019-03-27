const { ActionTransport } = require('@microfleet/core');
const redisKey = require('../../../utils/key');
const handlePipeline = require('../../../utils/pipelineError');
const { checkOrganizationExists } = require('../../../utils/organization');
const {
  ORGANIZATIONS_MEMBERS,
  USERS_ORGANIZATIONS,
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
  const { redis } = this;
  const { organizationId, username } = params;

  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, username);
  const userInOrganization = await redis.hget(memberKey, 'username');
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  const pipeline = redis.pipeline();
  pipeline.del(memberKey);
  pipeline.hdel(redisKey(username, USERS_ORGANIZATIONS), organizationId);
  pipeline.zrem(redisKey(organizationId, ORGANIZATIONS_MEMBERS), memberKey);

  return pipeline.exec().then(handlePipeline);
}

removeMember.allowed = checkOrganizationExists;
removeMember.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = removeMember;

const { ActionTransport } = require('@microfleet/core');
const redisKey = require('../../../utils/key');
const handlePipeline = require('../../../utils/pipelineError');
const { getOrganizationId } = require('../../../utils/organization');
const {
  ErrorOrganizationNotFound,
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
 * @apiParam (Payload) {String} name - organization name.
 * @apiParam (Payload) {String} username - member email.
 */
async function removeMember({ params }) {
  const service = this;
  const { redis } = service;
  const { name: organizationName, username } = params;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, username);
  const userInOrganization = await redis.hget(memberKey, 'username');
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  const pipeline = redis.pipeline();
  pipeline.del(memberKey);
  pipeline.hdel(redisKey(username, USERS_ORGANIZATIONS), organizationName);
  pipeline.zrem(redisKey(organizationId, ORGANIZATIONS_MEMBERS), memberKey);

  return pipeline.exec().then(handlePipeline);
}

removeMember.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = removeMember;

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

module.exports = async function removeMember({ params }) {
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
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

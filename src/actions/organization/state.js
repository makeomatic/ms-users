const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../utils/organization');
const { ErrorOrganizationNotFound, ORGANIZATIONS_ACTIVE_FLAG, ORGANIZATIONS_DATA } = require('../../constants');
const redisKey = require('../../utils/key');

module.exports = async function updateOrganizationState({ params }) {
  const service = this;
  const { redis } = service;
  const { name: organizationName, active } = params;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  const organizationDataKey = redisKey(organizationId, ORGANIZATIONS_DATA);
  await redis.hset(organizationDataKey, ORGANIZATIONS_ACTIVE_FLAG, active);


  return getOrganizationMetadataAndMembers.call(this, organizationId);
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../constants');

module.exports = async function getOrganization({ params }) {
  const service = this;
  const { name: organizationName } = params;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  return getOrganizationMetadataAndMembers.call(this, organizationId);
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

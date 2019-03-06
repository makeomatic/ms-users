const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../../constants');
const addOrganizationMembers = require('../../../utils/addOrganizationMembers');

module.exports = async function addOrganizationMember({ params }) {
  const service = this;
  const { config } = service;
  const { name: organizationName, username, permissions } = params;
  const { audience } = config.organizations;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  await addOrganizationMembers.call(service, {
    organizationId,
    organizationName,
    audience,
    members: [{ id: username, permissions }],
  });

  return getOrganizationMetadataAndMembers.call(this, organizationId);
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

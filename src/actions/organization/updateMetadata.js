const { ActionTransport } = require('@microfleet/core');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../constants');

module.exports = async function updateOrganizationMetadata({ params }) {
  const service = this;
  const { config } = service;
  const { name: organizationName, metadata } = params;
  const { audience } = config.organizations;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  if (metadata) {
    await setOrganizationMetadata.call(service, {
      organizationId,
      audience,
      metadata,
    });
  }

  return getOrganizationMetadataAndMembers.call(this, organizationId);
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

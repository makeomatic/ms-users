const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../constants');
const { getOrganizationMetadata } = require('../../utils/organization');

module.exports = async function organizationMembersList({ params }) {
  const { name: organizationName } = params;

  const organizationId = await getOrganizationId.call(this, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  const metadata = await getOrganizationMetadata.call(this, organizationId);
  return { metadata };
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

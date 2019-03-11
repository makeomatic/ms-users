const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../../constants');
const { getOrganizationMembers } = require('../../../utils/organization');

module.exports = async function organizationMembersList({ params }) {
  const { name: organizationName } = params;

  const organizationId = await getOrganizationId.call(this, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  return getOrganizationMembers.call(this, organizationId);
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

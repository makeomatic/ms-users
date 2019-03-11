const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../../constants');
const addOrganizationMembers = require('../../../utils/organization/addOrganizationMembers');

module.exports = async function addOrganizationMember({ params }) {
  const service = this;
  const { config } = service;
  const { name: organizationName, email, permissions, firstName, lastName } = params;
  const { audience } = config.organizations;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  return addOrganizationMembers.call(service, {
    organizationId,
    organizationName,
    audience,
    members: [{ username: email, permissions, firstName, lastName }],
  });
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

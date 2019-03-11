const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');
const { generateInvite } = require('../../invite');
const { getOrganizationId } = require('../../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../../constants');

module.exports = async function sendOrganizationInvite({ params }) {
  const service = this;
  const { name: organizationName, email } = params;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  return Promise
    .bind(this, { email })
    .then(generateInvite);
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

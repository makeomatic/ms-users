const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');
const { generateInvite } = require('../../invite');
const { getOrganizationId } = require('../../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../../constants');

/**
 * @api {amqp} <prefix>.invites.send Send invitation
 * @apiVersion 1.0.0
 * @apiName invites.send
 * @apiGroup Organizations
 *
 * @apiDescription In a normal flow - sends out an email to a Customer to accept invitation to the organization.
 * Can potentially be used by other Customers in the same organization
 *
 * @apiParam (Payload) {String} name - organization name.
 * @apiParam (Payload) {String} username - member email.
 */
async function sendOrganizationInvite({ params }) {
  const service = this;
  const { name: organizationName, email } = params;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  return Promise
    .bind(this, { email })
    .then(generateInvite);
}

sendOrganizationInvite.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = sendOrganizationInvite;

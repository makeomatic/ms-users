const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../constants');
const { getOrganizationMetadata } = require('../../utils/organization');

/**
 * @api {amqp} <prefix>.getMetadata Get organization metadata
 * @apiVersion 1.0.0
 * @apiName getMetadata
 * @apiGroup Organizations
 *
 * @apiParam (Payload) {String} name - organization name.
 *
 * @apiSuccess (Response) {Object} metadata - organization metadata
 */
async function organizationMetadata({ params }) {
  const { name: organizationName } = params;

  const organizationId = await getOrganizationId.call(this, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  const metadata = await getOrganizationMetadata.call(this, organizationId);
  return { metadata };
}

organizationMetadata.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = organizationMetadata;

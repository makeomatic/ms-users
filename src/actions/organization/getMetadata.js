const { ActionTransport } = require('@microfleet/core');
const { getOrganizationMetadata, checkOrganizationExists } = require('../../utils/organization');

/**
 * @api {amqp} <prefix>.getMetadata Get organization metadata
 * @apiVersion 1.0.0
 * @apiName getMetadata
 * @apiGroup Organizations
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 *
 * @apiSuccess (Response) {Object} metadata - organization metadata
 */
async function organizationMetadata({ params }) {
  const { organizationId } = params;

  const metadata = await getOrganizationMetadata.call(this, organizationId);
  return {
    data: {
      id: organizationId,
      metadata,
    },
  };
}

organizationMetadata.allowed = checkOrganizationExists;
organizationMetadata.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = organizationMetadata;

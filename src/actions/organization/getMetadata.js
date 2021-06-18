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
 * @apiSuccess (Response) {Object} data - response data.
 * @apiSuccess (Response) {Object} data.id - organization id
 * @apiSuccess (Response) {String} data.type - response type.
 * @apiSuccess (Response) {Object} data.attributes.metadata - organization metadata
 */
async function organizationMetadata({ params }) {
  const { organizationId, audience } = params;

  const metadata = await getOrganizationMetadata.call(this, organizationId, audience);
  return {
    data: {
      id: organizationId,
      type: 'organizationMetadata',
      attributes: metadata,
    },
  };
}

organizationMetadata.allowed = checkOrganizationExists;
organizationMetadata.readonly = true;
organizationMetadata.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = organizationMetadata;

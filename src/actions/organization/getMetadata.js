const { ActionTransport } = require('@microfleet/core');
const { getOrganizationMetadata, checkOrganizationExists } = require('../../utils/organization');

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
async function organizationMetadata() {
  const { organizationId } = this.locals;

  const metadata = await getOrganizationMetadata.call(this, organizationId);
  return { metadata };
}

organizationMetadata.allowed = checkOrganizationExists;
organizationMetadata.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = organizationMetadata;

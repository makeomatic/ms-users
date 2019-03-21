const { ActionTransport } = require('@microfleet/core');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const { checkOrganizationExists, getOrganizationMetadata } = require('../../utils/organization');

/**
 * @api {amqp} <prefix>.updateMetadata Update metadata organization
 * @apiVersion 1.0.0
 * @apiName updateMetadata
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to update organization metadata.
 *
 * @apiParam (Payload) {String} name - organization name.
 * @apiParam (Payload) {Object} metadata - metadata operations,
 *   supports `$set key:value`, `$remove keys[]`, `$incr key:diff`
 *
 * @apiSuccess (Response) {Object} metadata - organization metadata
 */
async function updateOrganizationMetadata({ params }) {
  const { config, locals } = this;
  const { organizationId } = locals;
  const { metadata } = params;
  const { audience } = config.organizations;

  if (metadata) {
    await setOrganizationMetadata.call(this, {
      organizationId,
      audience,
      metadata,
    });
  }

  const data = await getOrganizationMetadata.call(this, organizationId);
  return { metadata: data };
}

updateOrganizationMetadata.allowed = checkOrganizationExists;
updateOrganizationMetadata.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = updateOrganizationMetadata;

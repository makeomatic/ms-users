const { ActionTransport } = require('@microfleet/core');
const setOrganizationMetadata = require('../../utils/set-organization-metadata');
const { checkOrganizationExists, getOrganizationMetadata } = require('../../utils/organization');
const { ORGANIZATIONS_INDEX } = require('../../constants');

/**
 * @api {amqp} <prefix>.updateMetadata Update metadata organization
 * @apiVersion 1.0.0
 * @apiName updateMetadata
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to update organization metadata.
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {Object} metadata - metadata operations,
 *   supports `$set key:value`, `$remove keys[]`, `$incr key:diff`
 *
 * @apiSuccess (Response) {Object} data - response data.
 * @apiSuccess (Response) {Object} data.id - organization id
 * @apiSuccess (Response) {String} data.type - response type.
 * @apiSuccess (Response) {Object} data.attributes - organization metadata
 */
async function updateOrganizationMetadata({ params }) {
  const { config, redis } = this;
  const { metadata, organizationId, audience } = params;
  const { audience: defaultAudience } = config.organizations;

  if (metadata) {
    await setOrganizationMetadata.call(this, {
      organizationId,
      audience: audience || defaultAudience,
      metadata,
    });
  }

  // clear cache
  const now = Date.now();
  await redis.fsortBust(ORGANIZATIONS_INDEX, now);

  const data = await getOrganizationMetadata.call(this, organizationId, audience);

  return {
    data: {
      id: organizationId,
      type: 'organizationMetadata',
      attributes: data,
    },
  };
}

updateOrganizationMetadata.allowed = checkOrganizationExists;
updateOrganizationMetadata.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = updateOrganizationMetadata;

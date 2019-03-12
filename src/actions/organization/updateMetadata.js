const { ActionTransport } = require('@microfleet/core');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const { getOrganizationId, getOrganizationMetadata } = require('../../utils/organization');
const { ErrorOrganizationNotFound } = require('../../constants');

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
  const service = this;
  const { config } = service;
  const { name: organizationName, metadata } = params;
  const { audience } = config.organizations;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  if (metadata) {
    await setOrganizationMetadata.call(service, {
      organizationId,
      audience,
      metadata,
    });
  }

  const data = await getOrganizationMetadata.call(this, organizationId);
  return { metadata: data };
}

updateOrganizationMetadata.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = updateOrganizationMetadata;

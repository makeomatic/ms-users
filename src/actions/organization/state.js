const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../utils/organization');
const { ErrorOrganizationNotFound, ORGANIZATIONS_ACTIVE_FLAG, ORGANIZATIONS_DATA } = require('../../constants');
const redisKey = require('../../utils/key');

/**
 * @api {amqp} <prefix>.state Update organization state
 * @apiVersion 1.0.0
 * @apiName state
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to update organization state.
 *
 * @apiParam (Payload) {String} name - organization name.
 * @apiParam (Payload) {Boolean} active=false - organization state.
 */
async function updateOrganizationState({ params }) {
  const service = this;
  const { redis } = service;
  const { name: organizationName, active = false } = params;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  const organizationDataKey = redisKey(organizationId, ORGANIZATIONS_DATA);
  return redis.hset(organizationDataKey, ORGANIZATIONS_ACTIVE_FLAG, active);
}

updateOrganizationState.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = updateOrganizationState;

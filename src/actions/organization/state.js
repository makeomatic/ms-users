const { ActionTransport } = require('@microfleet/core');
const { checkOrganizationExists } = require('../../utils/organization');
const { ORGANIZATIONS_ACTIVE_FLAG, ORGANIZATIONS_DATA } = require('../../constants');
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
  const { redis, locals } = this;
  const { organizationId } = locals;
  const { active = false } = params;

  const organizationDataKey = redisKey(organizationId, ORGANIZATIONS_DATA);
  return redis.hset(organizationDataKey, ORGANIZATIONS_ACTIVE_FLAG, active);
}

updateOrganizationState.allowed = checkOrganizationExists;
updateOrganizationState.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = updateOrganizationState;

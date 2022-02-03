const { ActionTransport } = require('../../re-export');

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
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {Boolean} active=false - organization state.
 *
 * @apiSuccess (Response) {Object} data - response data.
 * @apiSuccess (Response) {String} data.id - organization id.
 * @apiSuccess (Response) {String} data.type - response type.
 * @apiSuccess (Response) {Boolean} data.attributes.active - organization state.
 */
async function updateOrganizationState({ params }) {
  const { redis } = this;
  const { organizationId, active = false } = params;

  const organizationDataKey = redisKey(organizationId, ORGANIZATIONS_DATA);
  await redis.hset(organizationDataKey, ORGANIZATIONS_ACTIVE_FLAG, active);

  return {
    data: {
      id: organizationId,
      type: 'organizationState',
      attributes: { active },
    },
  };
}

updateOrganizationState.allowed = checkOrganizationExists;
updateOrganizationState.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = updateOrganizationState;

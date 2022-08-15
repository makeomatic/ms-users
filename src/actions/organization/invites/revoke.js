const { ActionTransport } = require('@microfleet/plugin-router');

const { checkOrganizationExists } = require('../../../utils/organization');
const { organizationInvite, inviteId, USERS_ACTION_ORGANIZATION_INVITE } = require('../../../constants');

/**
 * @api {amqp} <prefix>.invites.revoke Revoke invitation
 * @apiVersion 1.0.0
 * @apiName invites.revoke
 * @apiGroup Organizations
 *
 * @apiDescription In a normal flow - revoke organization invite by email.
 * Can potentially be used by other Customers in the same organization
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {String} member - member.
 */
async function revokeOrganizationInvite({ params }) {
  const { member, organizationId } = params;

  await this.tokenManager.remove({ id: inviteId(organizationId, member.email), action: USERS_ACTION_ORGANIZATION_INVITE });
  return this.redis.srem(organizationInvite(organizationId), member.email);
}

revokeOrganizationInvite.allowed = checkOrganizationExists;
revokeOrganizationInvite.validateResponse = false;
revokeOrganizationInvite.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = revokeOrganizationInvite;

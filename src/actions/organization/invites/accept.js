const { ActionTransport } = require('@microfleet/core');
const { checkOrganizationExists } = require('../../../utils/organization');
const {
  USERS_ACTION_ORGANIZATION_INVITE,
  ErrorInvitationExpiredOrUsed,
  TOKEN_METADATA_FIELD_METADATA,
  inviteId,
} = require('../../../constants');
const addOrganizationMembers = require('../../../utils/organization/add-organization-members');

/**
 * Token verification function, on top of it returns extra metadata
 * @return {Promise}
 */
async function verifyToken(tokenManager, token, username, organizationId) {
  const control = { action: USERS_ACTION_ORGANIZATION_INVITE, id: inviteId(organizationId, username) };

  const tokenData = await tokenManager.verify(token, { erase: false, control });

  if (!tokenData.isFirstVerification) {
    throw ErrorInvitationExpiredOrUsed;
  }

  return tokenData.metadata[TOKEN_METADATA_FIELD_METADATA];
}

/**
 * @api {amqp} <prefix>.invites.accept Accept invitation
 * @apiVersion 1.0.0
 * @apiName invites.accept
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to accept invitation.
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {String} username - member email.
 */
async function acceptOrganizationMember({ params }) {
  const { config } = this;
  const { member, inviteToken, password, organizationId } = params;
  const { audience } = config.organizations;

  const memberInviteMetadata = await verifyToken(this.tokenManager, inviteToken, member.email, organizationId);
  member.permissions = memberInviteMetadata.permissions;
  member.password = password;

  return addOrganizationMembers.call(this, {
    organizationId,
    audience,
    members: [member],
  });
}

acceptOrganizationMember.allowed = checkOrganizationExists;
acceptOrganizationMember.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = acceptOrganizationMember;

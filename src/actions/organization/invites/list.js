const Promise = require('bluebird');

const { ActionTransport } = require('../../../re-export');

const { checkOrganizationExists } = require('../../../utils/organization');
const { organizationInvite, inviteId, USERS_ACTION_ORGANIZATION_INVITE, TOKEN_METADATA_FIELD_METADATA } = require('../../../constants');

const mapUser = ({ id, created, metadata } = {}) => {
  if (!id || id === '') return false;
  const [, userId] = id.split(':');

  return {
    id: userId,
    type: 'organization-invite',
    attributes: { id: userId, metadata: metadata[TOKEN_METADATA_FIELD_METADATA], created },
  };
};

function getTokenInfo(email) {
  return this.tokenManager.info({
    id: inviteId(this.organizationId, email),
    action: USERS_ACTION_ORGANIZATION_INVITE,
  }).catch((e) => this.log.error('resolve token info error: %o', e));
}

/**
 * @api {amqp} <prefix>.invites.list Invitations list
 * @apiVersion 1.0.0
 * @apiName invites.list
 * @apiGroup Organizations
 *
 * @apiDescription Invitations list
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 */
async function listOrganizationInvite({ params }) {
  const { organizationId } = params;
  const invitesIds = await this.redis.smembers(organizationInvite(organizationId));
  const getInvitesInfo = invitesIds.map(getTokenInfo, { log: this.log, tokenManager: this.tokenManager, organizationId });
  const invites = await Promise.all(getInvitesInfo);

  return {
    data: invites.map(mapUser).filter((f) => f),
  };
}

listOrganizationInvite.allowed = checkOrganizationExists;
listOrganizationInvite.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = listOrganizationInvite;

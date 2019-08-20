const { ActionTransport } = require('@microfleet/core');
const { checkOrganizationExists } = require('../../../utils/organization');
const {
  ErrorUserNotMember,
  ORGANIZATIONS_MEMBERS,
  USERS_ACTION_ORGANIZATION_INVITE,
  ErrorInvitationExpiredOrUsed,
} = require('../../../constants');
const redisKey = require('../../../utils/key.js');
const getUserId = require('../../../utils/userData/getUserId');

/**
 * Token verification function, on top of it returns extra metadata
 * @return {Promise}
 */
async function verifyToken(tokenManager, params) {
  // we must ensure that token matches supplied ID
  // it can be overwritten by sending `anyUsername: true`
  const control = {
    action: USERS_ACTION_ORGANIZATION_INVITE,
    id: params.username,
  };

  const token = await tokenManager
    .verify(params.inviteToken, { erase: false, control });

  if (!token.isFirstVerification) {
    throw ErrorInvitationExpiredOrUsed;
  }
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
  const { redis } = this;
  const { username, organizationId } = params;

  const userId = await getUserId.call(this, username);
  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId);
  const userInOrganization = await redis.hget(memberKey, 'username');
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  await verifyToken(this.tokenManager, params);

  const userAlreadyAccepted = await redis.hget(memberKey, 'accepted');

  if (userAlreadyAccepted) {
    return true;
  }

  return redis.hset(memberKey, 'accepted', Date.now());
}

acceptOrganizationMember.allowed = checkOrganizationExists;
acceptOrganizationMember.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = acceptOrganizationMember;

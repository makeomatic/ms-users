const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../../utils/organization');
const { ErrorOrganizationNotFound, ErrorUserNotMember, ORGANIZATIONS_MEMBERS } = require('../../../constants');
const redisKey = require('../../../utils/key.js');

/**
 * @api {amqp} <prefix>.invites.accept Accept invitation
 * @apiVersion 1.0.0
 * @apiName invites.accept
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to accept invitation.
 *
 * @apiParam (Payload) {String} name - organization name.
 * @apiParam (Payload) {String} username - member email.
 */
async function acceptOrganizationMember({ params }) {
  const { redis } = this;
  const { name: organizationName, username } = params;

  const organizationId = await getOrganizationId.call(this, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, username);
  const userInOrganization = await redis.hget(memberKey, 'username');
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  const userAlreadyAccepted = await redis.hget(memberKey, 'accepted');

  if (userAlreadyAccepted) {
    return true;
  }

  return redis.hset(memberKey, 'accepted', Date.now());
}

acceptOrganizationMember.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = acceptOrganizationMember;

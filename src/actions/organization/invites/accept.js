const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../../utils/organization');
const { ErrorOrganizationNotFound, ErrorUserNotFound, ErrorUserNotMember, ORGANIZATIONS_MEMBERS } = require('../../../constants');
const { resolveUserId } = require('../../../utils/userData');
const redisKey = require('../../../utils/key.js');

module.exports = async function acceptOrganizationMember({ params }) {
  const { redis } = this;
  const { name: organizationName, username } = params;

  const organizationId = await getOrganizationId.call(this, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  const userId = await Promise.bind(this, username)
    .tap(resolveUserId)
    .catch(ErrorUserNotFound);

  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId);
  const userInOrganization = await redis.hget(memberKey, 'id');
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  const userAlreadyAccepted = await redis.hget(memberKey, 'accepted');

  if (userAlreadyAccepted) {
    return true;
  }

  return redis.hset(memberKey, 'accepted', Date.now());
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

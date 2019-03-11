const { ActionTransport } = require('@microfleet/core');
const { getOrganizationId } = require('../../../utils/organization');
const redisKey = require('../../../utils/key');
const { ErrorOrganizationNotFound, ErrorUserNotMember, ORGANIZATIONS_MEMBERS, USERS_ORGANIZATIONS } = require('../../../constants');

module.exports = async function addOrganizationMember({ params }) {
  const service = this;
  const { redis } = service;
  const { name: organizationName, username, permission } = params;

  const organizationId = await getOrganizationId.call(service, organizationName);
  if (!organizationId) {
    throw ErrorOrganizationNotFound;
  }

  const memberKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS, username);
  const userInOrganization = await redis.hget(memberKey, 'username');
  if (!userInOrganization) {
    throw ErrorUserNotMember;
  }

  const currentPermissions = await redis.hget(memberKey, 'permissions');
  let permissions = currentPermissions === '' ? [] : currentPermissions.split(',');

  const { $set = [], $remove = [] } = permission;

  for (const permissionItem of $set) {
    if (!permissions.includes(permissionItem)) {
      permissions.push(permissionItem);
    }
  }

  for (const permissionItem of $remove) {
    permissions = permissions.filter(item => item !== permissionItem);
  }

  return redis.hset(redisKey(username, USERS_ORGANIZATIONS), organizationName, JSON.stringify(currentPermissions));
};

// init transport
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

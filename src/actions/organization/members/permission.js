const { ActionTransport } = require('@microfleet/core');
const { checkOrganizationExists } = require('../../../utils/organization');
const redisKey = require('../../../utils/key');
const handlePipeline = require('../../../utils/pipelineError');
const getUserId = require('../../../utils/userData/getUserId');
const { ErrorUserNotMember, USERS_METADATA, ORGANIZATIONS_MEMBERS } = require('../../../constants');

/**
 * @api {amqp} <prefix>.members.permission Sets permission levels for a given user
 * @apiVersion 1.0.0
 * @apiName members.permission
 * @apiGroup Organizations
 *
 * @apiDescription Sets permission levels for a given user.
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 * @apiParam (Payload) {String} username - organization member email.
 * @apiParam (Payload) {Object} permission - metadata operations,
 *   supports `$set string[]`, `$remove string[]`
 */
async function setOrganizationMemberPermission({ params }) {
  const service = this;
  const { redis } = service;
  const { organizationId, username, permission } = params;
  const { audience } = config.organizations;

  const userId = await getUserId.call(this, username);
  const memberMetadataKey = redisKey(userId, USERS_METADATA, audience);
  const userPermissions = await redis.hget(memberMetadataKey, organizationId);
  if (!userPermissions) {
    throw ErrorUserNotMember;
  }

  let permissions = userPermissions === '' ? [] : userPermissions.split(',');

  const { $set = [], $remove = [] } = permission;

  for (const permissionItem of $set) {
    if (!permissions.includes(permissionItem)) {
      permissions.push(permissionItem);
    }
  }

  for (const permissionItem of $remove) {
    permissions = permissions.filter(item => item !== permissionItem);
  }

  const pipeline = redis.pipeline();
  pipeline.hset(memberMetadataKey, organizationId, JSON.stringify(permissions));
  pipeline.hset(redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId), 'permissions', JSON.stringify(permissions));

  return pipeline.exec().then(handlePipeline);
}

setOrganizationMemberPermission.allowed = checkOrganizationExists;
setOrganizationMemberPermission.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = setOrganizationMemberPermission;

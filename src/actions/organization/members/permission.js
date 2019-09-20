const { ActionTransport } = require('@microfleet/core');
const union = require('lodash/union');
const difference = require('lodash/difference');
const { checkOrganizationExists } = require('../../../utils/organization');
const redisKey = require('../../../utils/key');
const handlePipeline = require('../../../utils/pipeline-error');
const getUserId = require('../../../utils/userData/get-user-id');
const UserMetadata = require('../../../utils/metadata/user');
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
  const { redis, config } = this;
  const { organizationId, username, permission } = params;
  const { audience } = config.organizations;

  const userId = await getUserId.call(this, username);
  const memberMetadataKey = redisKey(userId, USERS_METADATA, audience);
  const userPermissions = await redis.hget(memberMetadataKey, organizationId);
  if (!userPermissions) {
    throw ErrorUserNotMember;
  }

  let permissions = userPermissions.length ? [] : JSON.parse(userPermissions);

  const { $set = [], $remove = [] } = permission;

  permissions = union(permissions, $set);
  permissions = difference(permissions, $remove);
  permissions = JSON.stringify(permissions);

  const pipeline = redis.pipeline();
  const userMetadata = new UserMetadata(pipeline);

  userMetadata.update(userId, organizationId, permissions);
  pipeline.hset(redisKey(organizationId, ORGANIZATIONS_MEMBERS, userId), 'permissions', permissions);

  return pipeline.exec().then(handlePipeline);
}

setOrganizationMemberPermission.allowed = checkOrganizationExists;
setOrganizationMemberPermission.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = setOrganizationMemberPermission;

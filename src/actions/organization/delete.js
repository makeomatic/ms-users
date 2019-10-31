const { ActionTransport } = require('@microfleet/core');
const snakeCase = require('lodash/snakeCase');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipeline-error');
const { checkOrganizationExists, getInternalData } = require('../../utils/organization');
const {
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_METADATA,
  ORGANIZATIONS_MEMBERS,
  ORGANIZATIONS_NAME_TO_ID,
  USERS_METADATA,
  ORGANIZATIONS_INDEX,
  ORGANIZATIONS_NAME_FIELD,
} = require('../../constants');

/**
 * @api {amqp} <prefix>.delete Delete organization
 * @apiVersion 1.0.0
 * @apiName delete
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to delete organization.
 *
 * @apiParam (Payload) {String} organizationId - organization id.
 */
async function deleteOrganization({ params }) {
  const service = this;
  const { redis, config } = service;
  const { organizationId } = params;
  const { audience } = config.organizations;

  const organizationMembersListKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
  const organizationMembersIds = await redis.zrange(organizationMembersListKey, 0, -1);
  const organization = await getInternalData.call(this, organizationId);

  const pipeline = redis.pipeline();

  pipeline.del(redisKey(organizationId, ORGANIZATIONS_DATA));
  pipeline.del(redisKey(organizationId, ORGANIZATIONS_METADATA, audience));
  pipeline.srem(ORGANIZATIONS_INDEX, organizationId);
  if (organizationMembersIds) {
    organizationMembersIds.forEach((memberId) => {
      pipeline.del(memberId);
      pipeline.hdel(redisKey(memberId.split('!').pop(), USERS_METADATA, audience), organizationId);
    });
    pipeline.del(organizationMembersListKey);
  }
  pipeline.hdel(ORGANIZATIONS_NAME_TO_ID, snakeCase(organization[ORGANIZATIONS_NAME_FIELD]));
  await pipeline.exec().then(handlePipeline);
  await redis.fsortBust(ORGANIZATIONS_INDEX, Date.now());

  return [];
}

deleteOrganization.allowed = checkOrganizationExists;
deleteOrganization.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = deleteOrganization;

const { ActionTransport } = require('@microfleet/core');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const { checkOrganizationExists } = require('../../utils/organization');
const {
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_METADATA,
  ORGANIZATIONS_MEMBERS,
  ORGANIZATIONS_NAME_TO_ID,
  USERS_ORGANIZATIONS,
  ORGANIZATIONS_INDEX,
} = require('../../constants');

/**
 * @api {amqp} <prefix>.delete Delete organization
 * @apiVersion 1.0.0
 * @apiName delete
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to delete organization.
 *
 * @apiParam (Payload) {String} name - organization name.
 */
async function deleteOrganization({ params }) {
  const service = this;
  const { redis, config } = service;
  const { name: organizationName } = params;
  const { audience } = config.organizations;
  const { organizationId } = this.locals;

  const organizationMembersListKey = redisKey(organizationId, ORGANIZATIONS_MEMBERS);
  const organizationMembersIds = await redis.zscan(organizationMembersListKey, 0);

  const pipeline = redis.pipeline();

  pipeline.del(redisKey(organizationId, ORGANIZATIONS_DATA));
  pipeline.del(redisKey(organizationId, ORGANIZATIONS_METADATA, audience));
  pipeline.srem(ORGANIZATIONS_INDEX, organizationId);
  if (organizationMembersIds) {
    organizationMembersIds[1].forEach((memberId, index) => {
      if (index === 0 || index % 2 === 0) {
        pipeline.del(memberId);
        pipeline.hdel(redisKey(memberId.split('!').pop(), USERS_ORGANIZATIONS), organizationName);
      }
    });
    pipeline.del(organizationMembersListKey);
  }
  pipeline.hdel(ORGANIZATIONS_NAME_TO_ID, organizationName);

  return pipeline.exec().then(handlePipeline);
}

deleteOrganization.auth = 'bearer';
deleteOrganization.allowed = checkOrganizationExists;
deleteOrganization.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = deleteOrganization;

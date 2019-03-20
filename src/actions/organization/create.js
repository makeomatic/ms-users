const { ActionTransport } = require('@microfleet/core');
const snakeCase = require('lodash/snakeCase');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const addOrganizationMembers = require('../../utils/organization/addOrganizationMembers');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../utils/organization');
const {
  ErrorConflictOrganizationExists,
  ORGANIZATIONS_NAME_FIELD,
  ORGANIZATIONS_ACTIVE_FLAG,
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_NAME_TO_ID,
} = require('../../constants');

/**
 * @api {amqp} <prefix>.create Create organization
 * @apiVersion 1.0.0
 * @apiName create
 * @apiGroup Organizations
 *
 * @apiDescription This should be used to create organization.
 *
 * @apiParam (Payload) {String} name - unique organization name.
 * @apiParam (Payload) {Boolean} active=false - organization state.
 * @apiParam (Payload) {Object} metadata - organization metadata
 * @apiParam (Payload) {Object[]} members - organization members.
 * @apiParam (Payload) {String} members.username - member email.
 * @apiParam (Payload) {String} members.firstName - member first name.
 * @apiParam (Payload) {String} members.lastName - member last name.
 * @apiParam (Payload) {String[]} members.permissions - member permission list.
 *
 * @apiSuccess (Response) {String} id - organization id.
 * @apiSuccess (Response) {String} name - organization name.
 * @apiSuccess (Response) {Boolean} active - organization state.
 * @apiSuccess (Response) {Object[]} members - organization members.
 * @apiSuccess (Response) {String} members.username - member email.
 * @apiSuccess (Response) {String} members.firstName - member first name.
 * @apiSuccess (Response) {String} members.lastName - member last name.
 * @apiSuccess (Response) {Date} members.invited - member invite date.
 * @apiSuccess (Response) {Date} members.accepted - member accept invite date.
 * @apiSuccess (Response) {String[]} members.permissions - member permission list.
 * @apiSuccess (Response) {Object} metadata - organization metadata
 */
async function createOrganization({ params }) {
  const service = this;
  const { redis, config } = service;
  const { name: organizationName, active = false, metadata, members } = params;
  const { audience } = config.organizations;
  const normalizedOrganizationName = snakeCase(organizationName);

  const organizationExists = await getOrganizationId.call(service, organizationName);
  if (organizationExists) {
    throw ErrorConflictOrganizationExists;
  }

  const organizationId = service.flake.next();
  const pipeline = redis.pipeline();
  const basicInfo = {
    [ORGANIZATIONS_NAME_FIELD]: organizationName,
    [ORGANIZATIONS_ACTIVE_FLAG]: active,
  };
  const organizationDataKey = redisKey(organizationId, ORGANIZATIONS_DATA);
  pipeline.hmset(organizationDataKey, basicInfo);
  pipeline.hset(ORGANIZATIONS_NAME_TO_ID, normalizedOrganizationName, organizationId);
  await pipeline.exec().then(handlePipeline);

  if (metadata) {
    await setOrganizationMetadata.call(service, {
      organizationId,
      audience,
      metadata: {
        $set: metadata,
      },
    });
  }

  const invites = await addOrganizationMembers.call(service, {
    organizationId,
    organizationName,
    audience,
    members,
  });

  const response = await getOrganizationMetadataAndMembers.call(this, organizationId);

  return {
    ...response,
    invites,
  };
}

createOrganization.auth = 'httpBearer';
createOrganization.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = createOrganization;

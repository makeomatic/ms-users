const { ActionTransport } = require('@microfleet/core');
const snakeCase = require('lodash/snakeCase');
const mapValues = require('lodash/mapValues');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const setOrganizationMetadata = require('../../utils/setOrganizationMetadata');
const addOrganizationMembers = require('../../utils/organization/addOrganizationMembers');
const { getOrganizationId, getOrganizationMetadataAndMembers } = require('../../utils/organization');
const {
  ErrorConflictOrganizationExists,
  ORGANIZATIONS_NAME_FIELD,
  ORGANIZATIONS_ACTIVE_FLAG,
  ORGANIZATIONS_CREATED_FIELD,
  ORGANIZATIONS_DATA,
  ORGANIZATIONS_NAME_TO_ID,
  ORGANIZATIONS_INDEX,
  lockOrganization,
} = require('../../constants');

async function createOrganization(organizationName, active, lock) {
  const { redis, flake } = this;

  try {
    const normalizedOrganizationName = snakeCase(organizationName);
    const organizationId = flake.next();
    const pipeline = redis.pipeline();
    const organizationDataKey = redisKey(organizationId, ORGANIZATIONS_DATA);
    const basicInfo = {
      [ORGANIZATIONS_NAME_FIELD]: organizationName,
      [ORGANIZATIONS_ACTIVE_FLAG]: active,
      [ORGANIZATIONS_CREATED_FIELD]: Date.now(),
    };

    pipeline.hmset(organizationDataKey, mapValues(basicInfo, data => JSON.stringify(data)));
    pipeline.hset(ORGANIZATIONS_NAME_TO_ID, normalizedOrganizationName, organizationId);
    pipeline.sadd(ORGANIZATIONS_INDEX, organizationId);
    await pipeline.exec().then(handlePipeline);

    return organizationId;
  } catch (e) {
    throw e;
  } finally {
    if (lock !== undefined) {
      await lock.release();
    }
  }
}

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
 * @apiSuccess (Response) {Object} data - response data.
 * @apiSuccess (Response) {Object} meta - response meta.
 * @apiSuccess (Response) {String} data.id - organization id.
 * @apiSuccess (Response) {String} data.type - response type.
 * @apiSuccess (Response) {String} data.attributes.id - organization id.
 * @apiSuccess (Response) {String} data.attributes.name - organization name.
 * @apiSuccess (Response) {Boolean} data.attributes.active - organization state.
 * @apiSuccess (Response) {Object[]} data.attributes.members - organization members.
 * @apiSuccess (Response) {String} data.attributes.members.username - member email.
 * @apiSuccess (Response) {String} data.attributes.members.firstName - member first name.
 * @apiSuccess (Response) {String} data.attributes.members.lastName - member last name.
 * @apiSuccess (Response) {Date} data.attributes.members.invited - member invite date.
 * @apiSuccess (Response) {Date} data.attributes.members.accepted - member accept invite date.
 * @apiSuccess (Response) {String[]} data.attributes.members.permissions - member permission list.
 * @apiSuccess (Response) {Object} data.attributes.metadata - organization metadata
 * @apiSuccess (Response) {String} meta.invites - organization invites list.
 */
async function createOrganizationAction({ params, locals }) {
  const service = this;
  const { name, active = false, metadata, members } = params;
  const { audience } = service.config.organizations;

  const organizationId = await createOrganization.call(this, name, active, locals.lock);

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
    audience,
    members,
  });

  const organization = await getOrganizationMetadataAndMembers.call(this, organizationId);

  return {
    data: {
      id: organizationId,
      type: 'organization',
      attributes: organization,
    },
    meta: {
      invites,
    },
  };
}

createOrganizationAction.transports = [ActionTransport.amqp, ActionTransport.internal];
createOrganizationAction.allowed = async function checkOrganizationExistsConflict(request) {
  const { name } = request.params;

  const organizationExists = await getOrganizationId.call(this, name);
  if (organizationExists) {
    throw ErrorConflictOrganizationExists;
  }

  if (!request.locals) {
    request.locals = {};
  }
  request.locals.lock = await this.dlock.once(lockOrganization(name));

  return null;
};

module.exports = createOrganizationAction;

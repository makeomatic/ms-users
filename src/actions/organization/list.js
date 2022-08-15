const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');

const { ActionTransport } = require('@microfleet/plugin-router');

const redisKey = require('../../utils/key');
const { getOrganizationMetadata, getInternalData, getOrganizationMemberDetails } = require('../../utils/organization');
const getMetadata = require('../../utils/get-metadata');
const { getUserId } = require('../../utils/userData');
const { ORGANIZATIONS_INDEX, ORGANIZATIONS_DATA } = require('../../constants');

async function findUserOrganization(userId) {
  const { audience: orgAudience } = this.config.organizations;

  const res = await getMetadata.call(this, userId, orgAudience);

  return [Object.keys(res[orgAudience])];
}

function relatedMember(member) {
  const { id, ...props } = member;

  return {
    id,
    type: 'organizationMember',
    attributes: {
      ...props,
    },
  };
}

async function findOrganization({
  criteria,
  order,
  strFilter,
  currentTime,
  offset,
  limit,
  expiration,
}) {
  const organizationsIds = await this.redis.fsort(
    ORGANIZATIONS_INDEX,
    redisKey('*', ORGANIZATIONS_DATA),
    criteria,
    order,
    strFilter,
    currentTime,
    offset,
    limit,
    expiration
  );
  const length = +organizationsIds.pop();

  return [organizationsIds, length];
}

/**
 * @api {amqp} <prefix>.list Retrieve Organizations list
 * @apiVersion 1.0.0
 * @apiName ListOrganizations
 * @apiGroup Organizations
 *
 * @apiDescription This method allows to list organizations. They can be sorted & filtered by
 * any metadata field.
 *
 * @apiParam (Payload) {Number} [offset=0] - cursor for pagination
 * @apiParam (Payload) {Number} [limit=10] - profiles per page
 * @apiParam (Payload) {String="ASC","DESC"} [order=ASC] - sort order
 * @apiParam (Payload) {String} [username] - if supplied, return user organizations
 * @apiParam (Payload) {String} [criteria] - if supplied, sort will be performed based on this field
 * @apiParam (Payload) {Object} [filter] to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified

 * @apiSuccess (Response) {Object[]} data - response data.
 * @apiSuccess (Response) {String} data.id - organization id.
 * @apiSuccess (Response) {String} data.type - response type.
 * @apiSuccess (Response) {String} data.attributes.id - organization id.
 * @apiSuccess (Response) {String} data.attributes.name - organization name.
 * @apiSuccess (Response) {Boolean} data.attributes.active - organization state.
 * @apiSuccess (Response) {Object} data.attributes.metadata - organization metadata
 * @apiSuccess (Response) {Object} meta - response meta.
 * @apiSuccess (Response) {Number} meta.cursor - cursor.
 * @apiSuccess (Response) {Number} meta.page - page.
 * @apiSuccess (Response) {Number} meta.pages - pages.
 * @apiSuccess (Response) {Number} meta.total - total.
 */
async function getOrganizationsList({ params }) {
  const {
    criteria,
    audience,
    limit = 10,
    offset = 0,
    order = 'ASC',
    expiration = 30000,
    filter,
    username, // return only user orgnization, ignore other filters and pagination
  } = params;

  const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
  const currentTime = Date.now();

  const userId = username ? await getUserId.call(this, username, true) : null;

  const [organizationsIds, length = 0] = username
    ? await findUserOrganization.call(this, userId)
    : await findOrganization.call(this, {
      criteria,
      order,
      strFilter,
      currentTime,
      offset,
      limit,
      expiration,
    });

  const organizations = await Promise.map(organizationsIds, async (organizationId) => {
    const getMember = userId ? [getOrganizationMemberDetails.call(this, organizationId, userId)] : [];

    const [organization, metadata, member] = await Promise.all([
      getInternalData.call(this, organizationId, true),
      getOrganizationMetadata.call(this, organizationId, audience),
      ...getMember,
    ]);

    const relatedData = member ? { relationships: relatedMember({ id: userId, ...member }) } : {};

    return {
      ...organization,
      metadata,
      ...relatedData,
    };
  });

  return {
    data: organizations.map((organization) => ({
      id: organization.id,
      type: 'organization',
      attributes: organization,
    })),
    meta: {
      cursor: offset + limit,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(length / limit),
      total: length,
    },
  };
}

getOrganizationsList.validateResponse = true;
getOrganizationsList.responseSchema = 'organization.list.response';
getOrganizationsList.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = getOrganizationsList;

const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const fsort = require('redis-filtered-sort');
const redisKey = require('../../utils/key');
const { getOrganizationMetadata, getInternalData } = require('../../utils/organization');
const { ORGANIZATIONS_INDEX, ORGANIZATIONS_DATA } = require('../../constants.js');

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
 * @apiParam (Payload) {String} [criteria] - if supplied, sort will be performed based on this field
 * @apiParam (Payload) {Object} [filter] to use, consult https://github.com/makeomatic/redis-filtered-sort, can already be stringified
 */
async function getOrganizationsList({ params }) {
  const { redis } = this;
  const {
    criteria,
    limit = 10,
    offset = 0,
    order = 'ASC',
    expiration = 30000,
    filter,
  } = params;

  const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
  const currentTime = Date.now();

  const organizationsIds = await redis.fsort(
    ORGANIZATIONS_INDEX,
    redisKey('*', ORGANIZATIONS_DATA),
    criteria, order, strFilter, currentTime, offset, limit, expiration
  );

  const length = +organizationsIds.pop();

  const organizations = await Promise.map(organizationsIds, async (organizationId) => {
    const [organization, metadata] = await Promise.all([
      getInternalData.call(this, organizationId, true),
      getOrganizationMetadata.call(this, organizationId),
    ]);

    return {
      ...organization,
      metadata,
    };
  });

  return {
    data: organizations,
    meta: {
      cursor: offset + limit,
      page: Math.floor(offset / limit) + 1,
      pages: Math.ceil(length / limit),
      total: length,
    },
  };
}

getOrganizationsList.transports = [ActionTransport.amqp, ActionTransport.internal];
module.exports = getOrganizationsList;

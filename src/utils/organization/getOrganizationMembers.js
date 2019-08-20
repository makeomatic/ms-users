const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const { ORGANIZATIONS_MEMBERS } = require('../../constants');
const redisKey = require('../key');

const JSONParse = d => JSON.parse(d);

async function getOrganizationMembers(organizationId) {
  const { redis } = this;
  const organizationMembersIds = await redis.zrange(redisKey(organizationId, ORGANIZATIONS_MEMBERS), 0, -1);
  let organizationMembersJobs = [];
  if (organizationMembersIds) {
    organizationMembersJobs = organizationMembersIds.map(organizationMemberId => redis.hgetall(organizationMemberId));
  }

  const members = await Promise.all(organizationMembersJobs);
  return members.map(member => mapValues(member, JSONParse));
}

module.exports = getOrganizationMembers;

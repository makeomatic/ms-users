const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const { ORGANIZATIONS_MEMBERS, USERS_DATA, USERS_BANNED_FLAG } = require('../../constants');
const redisKey = require('../key');

const JSONParse = (d) => JSON.parse(d);

async function getMemberData(organizationMemberId) {
  const [, , userId] = organizationMemberId.split('!');
  const organization = await this.redis.hgetall(organizationMemberId);
  const banned = await this.redis.hget(redisKey(userId, USERS_DATA), USERS_BANNED_FLAG);

  return mapValues({ ...organization, banned }, JSONParse);
}

async function getOrganizationMembers(organizationId) {
  const { redis } = this;
  const organizationMembersIds = await redis.zrange(redisKey(organizationId, ORGANIZATIONS_MEMBERS), 0, -1) || [];
  const organizationMembersJobs = organizationMembersIds.map(getMemberData, this);

  return Promise.all(organizationMembersJobs);
}

module.exports = getOrganizationMembers;
module.exports.getMemberData = getMemberData;

const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const { ORGANIZATIONS_MEMBERS } = require('../../constants');
const redisKey = require('../key');

const JSONParse = (d) => JSON.parse(d);

async function getMemberData(organizationMemberId) {
  const [, , userId] = organizationMemberId.split('!');
  const organization = await this.redis.hgetall(organizationMemberId);
  const banned = await this.userData.getBanned(userId);

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

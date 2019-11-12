const Promise = require('bluebird');
const RedisOrganization = require('./redis/organization');
const OrganizationMember = require('./member/member');

/**
 * Class Handing Organization actions
 */
class Organization {
  id = undefined;

  constructor(redis, orgId) {
    this.redis = redis;
    this.id = orgId;
    this.backend = new RedisOrganization(redis);
  }

  removeMember(memberId) {
    const orgMember = OrganizationMember.using(this.redis, memberId, this.id);
    const memberKey = orgMember.getOrganizationMemberKey();
    return Promise.all([
      orgMember.delete(),
      this.backend.removeMember(this.id, memberKey, this.redis),
    ]);
  }

  static filterIds(obj) {
    const ids = [];
    const re = /^\d+$/;
    for (const [key] of Object.entries(obj)) {
      if (re.test(key)) ids.push(key);
    }
    return ids;
  }

  static using(orgId, redis) {
    const org = new Organization(redis, orgId);
    return org;
  }
}

module.exports = Organization;

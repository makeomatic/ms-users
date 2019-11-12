const RedisOrgMember = require('./redis/member');

/**
 * Class handing Organization Member data
 */
class OrganizationMember {
  /**
   * @param {ioredis}redis
   * @param {String|Number}memberId
   * @param {String|Number}orgId
   */
  constructor(redis, memberId, orgId) {
    this.backend = new RedisOrgMember(redis);
    this.id = memberId;
    this.orgId = orgId;
  }

  /**
   * Deletes Organization Member record
   * @returns {*}
   */
  delete() {
    return this.backend.delete(this.orgId, this.id);
  }

  getOrganizationMemberKey(memberId = this.id, orgId = this.orgId) {
    return RedisOrgMember.getRedisKey(orgId, memberId);
  }

  static using(redis, memberId, orgId) {
    return new OrganizationMember(redis, memberId, orgId);
  }
}

module.exports = OrganizationMember;

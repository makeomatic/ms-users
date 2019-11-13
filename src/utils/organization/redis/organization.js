const assert = require('assert');
const { isRedis } = require('../../asserts/redis');
const isValidId = require('../../asserts/id');
const isNotEmptyString = require('../../asserts/string-not-empty');

const { ORGANIZATIONS_MEMBERS } = require('../../../constants');

/**
 * Class handles Organization Data Redis Backend
 */
class Organization {
  /**
   * @param {ioredis|Pipeline}redis
   */
  constructor(redis) {
    assert(isRedis(redis), 'must be a valid redis instance');
    this.redis = redis;
  }

  /**
   * Gets Key with Organization information
   * @param {String|Number}orgId
   * @returns {string}
   */
  static getMembersKey(orgId) {
    assert(isValidId(orgId), 'must be valid organization id');
    return `${orgId}!${ORGANIZATIONS_MEMBERS}`;
  }

  /**
   * Deletes provided member key from Organization Members list
   * @param {String|Number}orgId
   * @param {String}memberKey
   * @param {ioredis|Pipeline}[redis]
   * @returns {*}
   */
  removeMember(orgId, memberKey, redis = this.redis) {
    assert(isNotEmptyString(memberKey), 'must be not epty string');
    return redis.zrem(Organization.getMembersKey(orgId), memberKey);
  }
}

module.exports = Organization;

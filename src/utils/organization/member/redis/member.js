const mapValues = require('lodash/mapValues');
const assert = require('assert');
const { isRedis } = require('../../../asserts/redis');
const isValidId = require('../../../asserts/id');

const {
  ORGANIZATIONS_MEMBERS,
} = require('../../../../constants');

const JSONStringify = (data) => JSON.stringify(data);

/**
 * Class handling Organization member Redis backend
 */
class OrganizationMember {
  /**
   * @param {ioredis|Pipeline}redis
   */
  constructor(redis) {
    assert(isRedis(redis), 'must be a valid redis instance');
    this.redis = redis;
  }

  /**
   * Generates Organization member Redis key
   * @param {String|Number}orgId
   * @param {String|Number}memberId
   * @returns {string}
   */
  static getRedisKey(orgId, memberId) {
    assert(isValidId(orgId), 'must be valid organization id');
    assert(isValidId(memberId), 'must be valid member id');
    return `${orgId}!${ORGANIZATIONS_MEMBERS}!${memberId}`;
  }

  /**
   * Deletes Organization Member key
   * @param {String|Number}orgId
   * @param {String|Number}memberId
   * @param {ioredis|Pipeline}[redis]
   * @returns {*}
   */
  delete(orgId, memberId, redis = this.redis) {
    assert(isRedis(redis), 'must be a valid redis instance');
    return redis.del(OrganizationMember.getRedisKey(orgId, memberId));
  }

  /**
   * Updates Organization member hash contents
   * @param {String|Number}orgId
   * @param {String|Number}memberId
   * @param {Object}params
   * @param redis
   * @returns {*}
   */
  update(orgId, memberId, params, redis = this.redis) {
    assert(isRedis(redis), 'must be a valid redis instance');
    return redis.hmset(OrganizationMember.getRedisKey(orgId, memberId), OrganizationMember.stringify(params));
  }

  static stringify(params) {
    return mapValues(params, JSONStringify);
  }
}

module.exports = OrganizationMember;

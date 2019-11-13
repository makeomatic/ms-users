const Promise = require('bluebird');
const assert = require('assert');
const { LockAcquisitionError } = require('ioredis-lock');
const User = require('./user');
const UserMetadata = require('../metadata/user');
const Organization = require('../organization/organization');
const RedisInactiveUser = require('./redis/inactive-user');
const isNotEmptyString = require('../asserts/string-not-empty');

/**
 * Class handling Inactive User actions
 */
class InactiveUser {
  /**
   * @param {Microfleet}service
   * @param {ioredis}service.redis
   * @param {dlock}service.dlock
   * @param {Object}service.config
   */
  constructor(service) {
    this.service = service;
    this.backend = new RedisInactiveUser(this.service.redis);
  }

  /**
   * Attempts to acquire operation lock using `dlock`
   * @param {String}lockName
   * @returns {FunctionDisposer}
   */
  acquireLock(lockName) {
    assert(isNotEmptyString(lockName), 'must be valid lock name');
    const { dlock } = this.service;
    return dlock
      .once(lockName)
      .catch(LockAcquisitionError, () => null);
  }

  /**
   * Adds provided user id into inactive index
   * @param {String|Number}userId
   * @param {Number}created
   * @param {ioredis|pipeline}[pipeline]
   * @returns {Promise<*>|Pipeline}
   */
  add(userId, created, pipeline = undefined) {
    return this.backend.add(userId, created, pipeline);
  }

  /**
   * Deletes provided user id from inactive index
   * @param {String|Number}userId
   * @returns {Promise<*>|Pipeline}
   */
  delete(userId) {
    return this.backend.delete(userId);
  }

  /**
   * Acquires lock and executes `cleanUsers`
   * @param {Number}userTTL - interval seconds
   * @returns {Promise<any> | * | Promise<T>}
   */
  async cleanUsersOnce(userTTL) {
    const lock = await this.acquireLock('delete-inactive-users');
    if (lock === null) return null;
    const result = this.cleanUsers(userTTL);
    await lock.release();
    return result;
  }

  /**
   * @CAUTION Deletes Users whose ids were in index and their score < Now()-interval
   * @param {Number}userTTL -interval seconds
   * @returns {Promise<*>}
   */
  async cleanUsers(userTTL) {
    const { config, redis } = this.service;
    const { audience } = config.organizations;
    const user = new User(this.service);
    const work = [];

    const usersToDelete = await this.backend.get(userTTL);
    const userOrganizations = {};

    await Promise.map(usersToDelete, async (id) => {
      const metaData = await UserMetadata
        .using(id, audience, redis)
        .getMetadata();
      userOrganizations[id] = Organization.filterIds(metaData);
    });

    for (const userId of usersToDelete) {
      for (const orgId of userOrganizations[userId] || []) {
        work.push(
          Organization.using(orgId, redis).removeMember(userId)
        );
      }
      work.push(
        user
          .delete(userId)
          .then(() => this.delete(userId))
      );
    }
    await Promise.all(work);

    return usersToDelete.length;
  }
}

module.exports = InactiveUser;

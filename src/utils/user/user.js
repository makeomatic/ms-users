const Promise = require('bluebird');
const { LockAcquisitionError } = require('ioredis-lock');
const Errors = require('common-errors');
const get = require('lodash/get');
const handlePipeline = require('../pipeline-error');
const RedisUser = require('./redis/user');
const UserMetadata = require('../metadata/user');

const {
  USERS_ACTION_ACTIVATE, USERS_ACTION_REGISTER,
  USERS_ACTION_PASSWORD, USERS_ACTION_RESET,
  USERS_ACTION_ORGANIZATION_INVITE,
  SSO_PROVIDERS,
} = require('../../constants');

/**
 * Class managing User data and operations
 */
class User {
  /**
   * @param {Microfleet}service
   * @param {ioredis}service.redis
   * @param {dlock}service.dlock
   */
  constructor(service) {
    this.service = service;
    this.backend = new RedisUser(service.redis);
  }

  /**
   * Attempts to acquire operation lock using `dlock`
   * @param lockName
   * @returns {Promise<any> | *}
   */
  acquireLock(lockName) {
    const { dlock } = this.service;
    return dlock
      .once(lockName)
      .catch(LockAcquisitionError, () => null);
  }

  /**
   * Checks whether user is being deleted
   * @param {String|Number}userId
   * @returns {Promise<Boolean>}
   */
  isUserDeleting(userId) {
    return this.acquireLock(`delete-user-${userId}`)
      .catch(LockAcquisitionError, () => true)
      .return(false);
  }

  /**
   * Gets User data
   * @param {String|Number}userId
   */
  getData(userId) {
    return this.backend.getData(userId);
  }

  /**
   * Flushes caches
   * @returns {Promise<*>}
   */
  flushCaches() {
    return this.backend.flushCaches();
  }

  /**
   * @CAUTION Deletes user
   * @param {Object}user - User Data object
   * @param {Boolean}[throwError] - Throws Race Condition error if Delete process was already started
   * @returns {Promise<null>}
   */
  async delete(user, throwError = true) {
    const { id, username, alias, ...restData } = typeof user === 'object' ? user : await this.getData(user);
    const lock = await this.acquireLock(`delete-user-${id}`);

    if (lock === null) {
      if (throwError === true) {
        throw new Errors.HttpStatusError(429, 'user marked for deletion');
      }
      return null;
    }

    try {
      const { redis } = this.service;
      const pipeline = redis.pipeline();
      const userAudiences = await UserMetadata.using(id, null, redis).getAudience();
      const pipelinedMetadata = UserMetadata.using(id, null, pipeline);
      const ssoIds = [];

      for (const provider of SSO_PROVIDERS) {
        const uid = get(restData, `${provider}.uid`);
        if (uid) {
          ssoIds.push(uid);
        }
      }

      for (const metaAudience of userAudiences) {
        pipelinedMetadata.deleteMetadata(metaAudience, pipeline);
      }

      this.backend.delete({ id, username, alias, ssoIds }, pipeline);

      const [pipelineResult] = await Promise.all([
        pipeline.exec(),
        this.deleteUserTokens(username),
      ]);

      handlePipeline(pipelineResult);
    } finally {
      lock.release();
    }

    return id;
  }

  /**
   * Cleans User Action tokens
   * @param userEmail
   * @returns {Promise<*>}
   */
  deleteUserTokens(userEmail) {
    const actions = [
      USERS_ACTION_ACTIVATE, USERS_ACTION_REGISTER,
      USERS_ACTION_PASSWORD, USERS_ACTION_RESET,
      USERS_ACTION_ORGANIZATION_INVITE,
    ];
    const { tokenManager } = this.service;

    const work = [];

    for (const action of actions) {
      work.push(
        tokenManager
          .remove({ id: userEmail, action })
          .catch(() => {}) // ignore errors
      );
    }

    return Promise.all(work);
  }
}

module.exports = User;

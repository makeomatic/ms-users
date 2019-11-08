const Promise = require('bluebird');
const RedisInactiveUser = require('./redis/inactive-user');
const User = require('../user/user');

class InactiveUser {
  constructor(service) {
    this.service = service;
    this.backend = new RedisInactiveUser(service.redis);
  }

  acquireLock(lockName) {
    const { dlock } = this.service;
    return dlock
      .once(lockName)
      .disposer((l) => {
        l.release().reflect();
      });
  }

  add(userId, created, pipeline = undefined) {
    return this.backend.add(userId, created, pipeline);
  }

  delete(userId) {
    return this.backend.delete(userId);
  }

  deleteInactive(userTTL) {
    return Promise
      .using(this.acquireLock('delete-inactive-users'), () => this._deleteInactive(userTTL))
      .catch({ name: 'LockAcquisitionError' }, () => {});
  }

  async _deleteInactive(userTTL) {
    const user = new User(this.service);
    const inactiveUsers = await this.backend.get(userTTL);
    const work = [];

    for (const userId of inactiveUsers) {
      work.push(
        user
          .delete(userId)
          .then(() => this.backend.delete(userId))
      );
    }
    await Promise.all(work);

    return inactiveUsers.length;
  }
}

module.exports = InactiveUser;

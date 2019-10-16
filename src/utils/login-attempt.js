const assertStringNotEmpty = require('./asserts/string-not-empty');
const redisKey = require('./key');

/**
 * Class controlling User Login Attempts registry
 */
class LoginAttempt {
  constructor(redis) {
    this.redis = redis;
  }

  static USER_LOGIN_ATTEMPTS = 'user-login-attempts';

  static getRedisKey(user) {
    assertStringNotEmpty(user, '`user` invalid');
    return redisKey(user, LoginAttempt.USER_LOGIN_ATTEMPTS);
  }

  addAttempt(user, token) {
    return this.redis.sadd(LoginAttempt.getRedisKey(user), token);
  }

  deleteAttempt(user, token) {
    return this.redis.srem(LoginAttempt.getRedisKey(user), token);
  }

  getAttempts(user) {
    return this.redis.smembers(LoginAttempt.getRedisKey(user));
  }
}

module.exports = LoginAttempt;

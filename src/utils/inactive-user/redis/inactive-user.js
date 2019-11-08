class InactiveUser {
  static REDIS_KEY = 'users-inactivated';

  constructor(redis) {
    this.redis = redis;
  }

  get(interval) {
    const expire = Date.now() - (interval * 1000);
    return this.redis.zrangebyscore(InactiveUser.REDIS_KEY, '-inf', expire);
  }

  add(userId, createTime, redis = this.redis) {
    return redis.zadd(InactiveUser.REDIS_KEY, createTime, userId);
  }

  delete(userId, redis = this.redis) {
    return redis.zrem(InactiveUser.REDIS_KEY, userId);
  }
}

module.exports = InactiveUser;

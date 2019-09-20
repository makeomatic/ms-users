class Audience {
  constructor(redis, audienceKeyBase) {
    this.redis = redis;
    this.audienceKeyBase = audienceKeyBase;
  }

  getAudienceKey(id) {
    return `${id}!${this.audienceKeyBase}`;
  }

  add(id, audience, redis = this.redis) {
    return redis.sadd(this.getAudienceKey(id), audience);
  }

  batchAdd(id, audiences, redis = this.redis) {
    const audienceWork = [];
    for (const audience of Array.isArray(audiences) ? audiences : [audiences]) {
      audienceWork.push(
        redis.sadd(this.getAudienceKey(id), audience)
      );
    }
    return audienceWork;
  }

  delete(id, audience, redis = this.redis) {
    return redis.srem(this.getAudienceKey(id), audience);
  }
}

module.exports = Audience;

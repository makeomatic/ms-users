const Redis = require('ioredis');

function isRedisPipeline(value) {
  return value instanceof Redis.Pipeline;
}

function isRedis(value) {
  return value instanceof Redis || value instanceof Redis.Cluster || value instanceof Redis.Pipeline;
}

module.exports = {
  isRedisPipeline,
  isRedis,
};

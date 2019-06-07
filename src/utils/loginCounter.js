const redisKey = require('./key');

function redisLocalRemoteIpKey(userId, remoteip) {
  return redisKey(userId, 'ip', remoteip);
}

function redisGlobalRemoteIpKey(remoteip) {
  return redisKey('gl!ip!ctr', remoteip);
}

/**
 * Drops login attempts counter
 */
function redisDropLoginCounter(redis, remoteip, userId) {
  return redis.dropLoginCounter(
    2,
    redisLocalRemoteIpKey(userId, remoteip),
    redisGlobalRemoteIpKey(remoteip)
  );
}

module.exports = {
  redisDropLoginCounter,
  redisLocalRemoteIpKey,
  redisGlobalRemoteIpKey,
};

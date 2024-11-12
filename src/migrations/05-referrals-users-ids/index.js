const Promise = require('bluebird');
const calcSlot = require('cluster-key-slot');
const { REDIS_TYPE_CLUSTER } = require('@microfleet/plugin-redis-core');
const { USERS_REFERRAL_INDEX } = require('../../constants');
const { getUserId } = require('../../utils/user-data');

/**
 * Return master node in case of redisCluster to be able to use
 * specific commands like `keys`. We can use usual redis instance in
 * other cases.
 */
function getRedisMasterNode(redis, redisType, config) {
  if (redisType !== REDIS_TYPE_CLUSTER) {
    return redis;
  }
  const { keyPrefix } = config.redis.options;
  const slot = calcSlot(keyPrefix);
  const nodeKeys = redis.slots[slot];
  const masters = redis.connectionPool.nodes.master;

  return nodeKeys.reduce((node, key) => node || masters[key], null);
}

/**
 *
 */
function referralsUsersIds({ redis, config, log, redisType }) {
  const { keyPrefix } = config.redis.options;
  const masterNode = getRedisMasterNode(redis, redisType, config);
  const pipeline = redis.pipeline();

  return masterNode
    .keys(`${keyPrefix}${USERS_REFERRAL_INDEX}:*`)
    .map((key) => key.replace(keyPrefix, ''))
    .map((key) => {
      const referral = key.split(':')[1];

      log.info('Get members for:', referral);

      return Promise.join(referral, redis.smembers(`${USERS_REFERRAL_INDEX}:${referral}`));
    })
    .map(([referral, usernames]) => Promise
    // resolve user id for username
      .map(
        usernames,
        (username) => {
          log.info('Resolve user id for:', username);

          return Promise.join(username, getUserId.call({ redis }, username));
        }
      )
    // swap username to user id
      .map(([username, userId]) => {
        log.info('Resolved', username, 'is', userId);

        pipeline.sadd(`${USERS_REFERRAL_INDEX}:${referral}`, userId);
        pipeline.srem(`${USERS_REFERRAL_INDEX}:${referral}`, username);

        return null;
      }))
    .then(() => pipeline.exec());
}

module.exports = {
  script: referralsUsersIds,
  min: 4,
  final: 5,
};

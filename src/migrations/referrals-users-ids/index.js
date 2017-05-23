const Promise = require('bluebird');
const { USERS_REFERRAL_INDEX } = require('../../constants.js');
const { getUserId } = require('../../utils/userData');

const FINAL_VERSION = 5;
const MIN_VERSION = 4;

function referralsUsersIds({ redis, config, log }) {
  const { referrals } = config.migrations.meta.referralsUsersIds;
  const pipeline = redis.pipeline();

  return Promise
    .map(
      referrals,
      (referral) => {
        log.info('Get members for:', referral);

        return Promise.join(referral, redis.smembers(`${USERS_REFERRAL_INDEX}:${referral}`));
      }
    )
    .map(([referral, usernames]) =>
      Promise
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
        })
    )
    .then(() => pipeline.exec());
}

module.exports = {
  script: referralsUsersIds,
  min: MIN_VERSION,
  final: FINAL_VERSION,
};

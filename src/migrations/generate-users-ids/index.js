const Promise = require('bluebird');
const {
  // keys(parts): hash
  USERS_DATA,
  USERS_METADATA,
  USERS_TOKENS,
  // keys: set
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  // keys: hash
  USERS_ALIAS_TO_ID,
  USERS_USERNAME_TO_ID,
  USERS_SSO_TO_ID,
  // keys sorted set
  USERS_API_TOKENS_ZSET,
  // fields
  USERS_ID_FIELD,
  USERS_USERNAME_FIELD,
} = require('../../constants');
const makeKey = require('../../utils/key');
const safeParse = require('../../utils/safeParse');

function generateUsersIds({
  flake, redis, config, log,
}) {
  // used for renaming metadata keys
  const { audiences } = config.migrations.meta.generateUsersIds;
  const pipeline = redis.pipeline();

  audiences.push(config.jwt.defaultAudience);

  return redis
    .smembers(USERS_INDEX)
    .tap(({ length }) => log.info('Users count:', length))
    .map(username => Promise.join(username, redis.hgetall(makeKey(username, USERS_DATA))))
    .map(([username, userData]) => {
      const userId = flake.next();
      const oldUserDataKey = makeKey(username, USERS_DATA);
      const newUserDataKey = makeKey(userId, USERS_DATA);

      log.info('Generate', userId, 'for', username);

      // username to id
      pipeline.hset(USERS_USERNAME_TO_ID, username, userId);

      // alias to id
      if (userData.alias) {
        pipeline.hset(USERS_ALIAS_TO_ID, userData.alias, userId);
      }

      // sso
      if (userData.facebook) {
        const { uid: ssoId } = safeParse(userData.facebook);

        pipeline.hset(USERS_SSO_TO_ID, ssoId, userId);
      }

      // user data
      pipeline.hset(oldUserDataKey, USERS_ID_FIELD, userId);
      pipeline.hset(oldUserDataKey, USERS_USERNAME_FIELD, username);
      pipeline.rename(oldUserDataKey, newUserDataKey);

      // user metadata
      audiences.forEach((audience) => {
        const oldMetaDataKey = makeKey(username, USERS_METADATA, audience);
        const newMetaDataKey = makeKey(userId, USERS_METADATA, audience);

        pipeline.rename(oldMetaDataKey, newMetaDataKey);
      });

      // user tokens
      pipeline.rename(makeKey(username, USERS_TOKENS), makeKey(userId, USERS_TOKENS));

      // user api tokens
      pipeline.rename(
        makeKey(USERS_API_TOKENS_ZSET, username),
        makeKey(USERS_API_TOKENS_ZSET, userId)
      );

      return [username, userId];
    })
    .map(([username, userId]) => Promise.join(username, userId, redis.sismember(USERS_PUBLIC_INDEX, username)))
    .each(([username, userId, needUpdate]) => {
      // users index
      pipeline.sadd(USERS_INDEX, userId);
      pipeline.srem(USERS_INDEX, username);

      if (needUpdate) {
        // users public index
        pipeline.sadd(USERS_PUBLIC_INDEX, userId);
        pipeline.srem(USERS_PUBLIC_INDEX, username);
      }
    })
    .then(() => pipeline.exec());
}

module.exports = {
  script: generateUsersIds,
  min: 1,
  final: 4,
};

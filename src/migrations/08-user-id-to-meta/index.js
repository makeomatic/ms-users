const {
  USERS_METADATA,
  USERS_INDEX,
  USERS_ID_FIELD,
} = require('../../constants');
const makeRedisKey = require('../../utils/key');

async function userIdToMeta({ redis, config, log }) {
  const { migrations, jwt } = config;
  const audiences = [
    ...migrations.meta.userIdToMeta.audiences,
    jwt.defaultAudience,
  ];

  return (new Promise((resolve, reject) => {
    const stream = redis.sscanStream(USERS_INDEX, {
      count: 1000,
    });
    let usersCount = 0;

    stream.on('data', (usersIds) => {
      stream.pause();

      const pipeline = redis.pipeline();

      for (const audience of audiences) {
        for (const userId of usersIds) {
          const redisKey = makeRedisKey(userId, USERS_METADATA, audience);

          usersCount += 1;
          log.info(`${usersCount} HSETNX ${redisKey} ${USERS_ID_FIELD} ${JSON.stringify(userId)}`);
          // pipeline.hsetnx(redisKey, USERS_ID_FIELD, JSON.stringify(userId));
        }
      }

      pipeline.exec()
        .then(() => {
          stream.resume();
          return true;
        })
        .catch(reject);
    });

    stream.on('error', reject);
    stream.on('end', () => {
      log.info(`process ${usersCount} users`);
      // debug
      reject(new Error('Not today'));
      // resolve();
    });
  }));
}

module.exports = {
  script: userIdToMeta,
  min: 7,
  final: 8,
};

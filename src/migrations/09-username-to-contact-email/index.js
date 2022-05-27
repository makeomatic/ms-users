// Copy activated users username (if its email) to verified contact email
//
const Promise = require('bluebird');
const {
  // keys(parts): hash
  USERS_DATA,
  // keys: set
  USERS_INDEX,
  USERS_CONTACTS,
} = require('../../constants');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipeline-error');

const stringifyObj = (obj) => {
  const newObj = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    newObj[key] = JSON.stringify(value);
  }

  return newObj;
};

function copyUsernameToContact({
  redis,
  log,
}) {
  return (new Promise((resolve, reject) => {
    const stream = redis.sscanStream(USERS_INDEX, {
      count: 1000,
    });
    let usersCount = 0;

    stream.on('data', async (usersIds) => {
      stream.pause();

      const pipeline = redis.pipeline();
      for await (const userId of usersIds) {
        usersCount += 1;
        const { username, active } = await redis.hgetall(redisKey(userId, USERS_DATA));

        log.info('Progress userId: ', userId, 'username: ', username);
        if (/@/.test(username) && active) {
          log.info('email: ', username);
          const key = redisKey(userId, USERS_CONTACTS, username);
          pipeline.hmset(key, stringifyObj({
            value: username,
            type: 'email',
            verified: true,
          }));
        }
      }

      pipeline.exec()
        .then(handlePipeline)
        .then(() => {
          stream.resume();
          return true;
        })
        .catch(reject);
    });

    stream.on('error', reject);
    stream.on('end', () => {
      log.info(`Process ${usersCount} users`);
      resolve();
    });
  }));
}

module.exports = {
  script: copyUsernameToContact,
  min: 8,
  final: 9,
};

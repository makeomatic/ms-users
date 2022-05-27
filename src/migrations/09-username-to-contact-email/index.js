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

const stringifyObj = (obj) => {
  const newObj = Object.create(null);
  for (const [key, value] of Object.entries(obj)) {
    newObj[key] = JSON.stringify(value);
  }

  return newObj;
};

function copyUsernameToContact({
  redis, log,
}) {
  // used for renaming metadata keys
  const pipeline = redis.pipeline();

  return redis
    .smembers(USERS_INDEX)
    .tap(({ length }) => log.info('Users count:', length))
    .map((userId) => Promise.join(userId, redis.hgetall(redisKey(userId, USERS_DATA))))
    .each(([userId, { username, active }]) => {
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
    })
    .then(() => pipeline.exec());
}

module.exports = {
  script: copyUsernameToContact,
  min: 1,
  final: 4,
};

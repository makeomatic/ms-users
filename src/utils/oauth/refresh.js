const redisKey = require('../key.js');
const {
  USERS_DATA,
} = require('../../constants.js');

module.exports = function refresh(account, user) {
  const { redis } = this;
  const { username } = user;
  const { provider, internals } = account;
  const userDataKey = redisKey(username, USERS_DATA);

  return redis.hset(userDataKey, provider, JSON.stringify(internals))
    .return(true);
};

const Errors = require('common-errors');
const emailChallenge = require('../utils/send-email.js');
const redisKey = require('../utils/key.js');

module.exports = function sendChallenge(opts) {
  const { _redis: redis } = this;
  const { username } = opts;
  const userKey = redisKey(username, 'data');

  // TODO: record all attemps
  // TODO: add metadata processing on successful email challenge

  return redis
    .hget(userKey, 'active')
    .then((active) => {
      if (!active) {
        throw new Errors.HttpStatusError(404, 'user doesn\'t exist');
      }

      if (active === 'true') {
        throw new Errors.HttpStatusError(412, 'user is already active');
      }

      return emailChallenge.send.call(this, username);
    });
};

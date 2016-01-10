const Errors = require('common-errors');
const redisKey = require('../utils/key.js');
const emailValidation = require('../utils/send-email.js');

module.exports = function requestPassword(opts) {
  const { username } = opts;
  const { redis } = this;
  const userKey = redisKey(username, 'data');

  // TODO: make use of remoteip in security logs?
  // var remoteip = opts.remoteip;

  return redis
    .hmget(userKey, 'password', 'active', 'ban')
    .bind(this)
    .spread(function response(exists, isActive, isBanned) {
      if (exists === null) {
        throw new Errors.HttpStatusError(404, `${username} does not exist`);
      }

      if (isActive !== 'true') {
        throw new Errors.HttpStatusError(412, 'account is not active');
      }

      if (isBanned === 'true') {
        throw new Errors.HttpStatusError(423, 'account has been locked');
      }

      return emailValidation
        .send.call(this, username, opts.generateNewPassword ? 'password' : 'reset');
    })
    .return({ success: true });
};

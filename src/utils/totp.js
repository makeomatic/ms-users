const Promise = require('bluebird');
const { check } = require('otplib/authenticator');
const redisKey = require('./key');
const { hash } = require('./scrypt');
const {
  ErrorTotpRequired,
  ErrorTotpInvalid,
  USERS_2FA_SECRET,
  USERS_2FA_RECOVERY,
} = require('../constants');

exports.hasTotp = function hasTotp({ params, headers }) {
  if (params.totp || headers['X-Auth-TOTP']) {
    return null;
  }

  throw ErrorTotpRequired;
};

exports.checkTotp = async function checkTotp({ action, params, headers }) {
  if (!action.tfa) {
    return null;
  }

  const { username } = params;
  const { redis } = this;
  const secret = await redis.get(redisKey(USERS_2FA_SECRET, username));

  if (!secret) {
    return null;
  }

  const totp = params.totp || headers['X-Auth-TOTP'];

  if (!totp) {
    throw ErrorTotpRequired;
  }

  if (totp.length === 6 && !check(totp, secret)) {
    throw ErrorTotpInvalid;
  }

  const recoveryHash = await hash(totp);

  await redis
    .srem(redisKey(USERS_2FA_RECOVERY, username), recoveryHash)
    .catch({ message: 404 }, () => {
      return Promise.reject(ErrorTotpInvalid);
    });

  return null;
};

const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const jwtLib = Promise.promisifyAll(require('jsonwebtoken'));

const legacyJWT = require('./jwt-legacy');
const statelessJWT = require('./jwt-stateless');

const { USERS_INVALID_TOKEN } = require('../constants');

const {
  verifyData,
  signData,
  internal,
} = legacyJWT;

module.exports = exports = {
  verifyData,
  signData,
  internal,
};

/**
 * Verify data
 * @param  {String} token
 * @param  {Object} tokenOptions
 * @return {Promise}
 */
async function decodeAndVerify(service, token, audience) {
  const { jwt: { secret, extra, issuer, hashingFunction } } = service.config;
  try {
    // should await here, otherwise jwt.Error thrown
    const decoded = await jwtLib.verifyAsync(token, secret, {
      ...extra,
      audience,
      issuer,
      algorithms: [hashingFunction],
    });
    return decoded;
  } catch (e) {
    service.log.debug('error decoding token', e);
    throw USERS_INVALID_TOKEN;
  }
}

const statelessAvailable = (service) => {
  return service.config.jwt.stateless;
};

exports.login = function login(userId, audience) {
  if (this.config.jwt.stateless) {
    return statelessJWT.login(this, userId, audience);
  }

  return legacyJWT.login(this, userId, audience);
};

exports.logout = async function logout(token, audience) {
  const decodedToken = await decodeAndVerify(this, token, audience);

  if (statelessAvailable(this)) {
    return statelessJWT.logout(this, decodedToken);
  }

  return legacyJWT.logout(this, token, decodedToken);
};

exports.verify = async function verifyToken(token, audience, peek) {
  const decodedToken = await decodeAndVerify(this, token, audience);

  if (statelessAvailable(this)) {
    return statelessJWT.verify(this, decodedToken, audience, peek);
  }

  return legacyJWT.verify(this, token, decodedToken, audience, peek);
};

exports.reset = function reset(userId) {
  if (this.config.jwt.stateless) {
    return statelessJWT.reset(this, userId);
  }

  return legacyJWT.reset(this, userId);
};

exports.refresh = async function refresh(token, audience) {
  if (!statelessAvailable(this)) {
    throw new HttpStatusError(501, '`stateless` should be enabled');
  }

  const decodedToken = await decodeAndVerify(this, token, audience);
  return statelessJWT.refresh(this, decodedToken, audience);
};

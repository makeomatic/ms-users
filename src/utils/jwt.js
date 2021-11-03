const Promise = require('bluebird');
const { HttpStatusError } = require('common-errors');
const jwtLib = Promise.promisifyAll(require('jsonwebtoken'));

const {
  USERS_INVALID_TOKEN,
  USERS_ID_FIELD,
} = require('../constants');
const getMetadata = require('./get-metadata');

const legacyJWT = require('./jwt-legacy');
const statelessJWT = require('./jwt-stateless');

const {
  assertRefreshToken, assertAccessToken,
  isStatelessToken,
} = statelessJWT;

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

const mapJWT = (userId, { jwt, jwtRefresh }, metadata) => ({
  jwt,
  jwtRefresh,
  user: {
    [USERS_ID_FIELD]: userId,
    metadata,
  },
});

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

const getAudience = (defaultAudience, audience) => {
  if (audience !== defaultAudience) {
    return [audience, defaultAudience];
  }

  return [audience];
};

exports.login = async function login(userId, _audience, stateless = false) {
  const { defaultAudience } = this.config.jwt;

  const audience = _audience || defaultAudience;
  const metadataAudience = getAudience(defaultAudience, audience);

  const tokenFlow = stateless
    ? () => statelessJWT.login(this, userId, audience)
    : () => legacyJWT.login(this, userId, audience);

  const [flowResult, metadata] = await Promise.all([
    tokenFlow(),
    getMetadata.call(this, userId, metadataAudience),
  ]);

  return mapJWT(userId, flowResult, metadata);
};

exports.logout = async function logout(token, audience) {
  const decodedToken = await decodeAndVerify(this, token, audience);

  assertRefreshToken(decodedToken);

  await Promise.all([
    legacyJWT.logout(this, token, decodedToken),
    statelessJWT.logout(this, decodedToken),
  ]);

  return { success: true };
};

// Should check old tokens and new tokens
exports.verify = async function verifyToken(token, audience, peek) {
  const decodedToken = await decodeAndVerify(this, token, audience);

  assertAccessToken(decodedToken);

  if (!isStatelessToken(decodedToken)) {
    await legacyJWT.verify(this, token, decodedToken, audience, peek);
  }

  return statelessJWT.verify(this, decodedToken, audience);
};

exports.reset = async function reset(userId) {
  const resetResult = await Promise.all([
    statelessJWT.reset(this, userId),
    legacyJWT.reset(this, userId),
  ]);

  return resetResult;
};

exports.refresh = async function refresh(token, audience) {
  if (!statelessAvailable(this)) {
    throw new HttpStatusError(501, '`stateless` should be enabled');
  }

  const decodedToken = await decodeAndVerify(this, token, audience);

  assertRefreshToken(decodedToken);

  const userId = decodedToken[USERS_ID_FIELD];
  const [refreshResult, metadata] = await Promise.all([
    statelessJWT.refresh(this, decodedToken, audience),
    getMetadata.call(this, userId, audience),
  ]);

  return mapJWT(userId, refreshResult, metadata);
};

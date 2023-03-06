const Promise = require('bluebird');

const {
  USERS_INVALID_TOKEN,
  USERS_AUDIENCE_MISMATCH,
  USERS_ID_FIELD,
  USERS_USERNAME_FIELD,
} = require('../constants');
const getMetadata = require('./get-metadata');

const legacyJWT = require('./jwt-legacy');
const { JoseWrapper } = require('./stateless-jwt/jwe');
const statelessJWT = require('./stateless-jwt/jwt');
const { fromTokenData } = require('./verify');

/**
 * @typedef { import("@microfleet/core-types").Microfleet } Microfleet
 * */

const {
  assertRefreshToken,
  isStatelessToken, isStatelessEnabled,
  assertStatelessEnabled, checkToken,
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
 * @param  {Microfleet & { jwe: JoseWrapper }} service
 * @param  {String} token
 * @param  {Object} tokenOptions
 * @return {Promise}
 */
async function decodeAndVerify(service, token, audience) {
  const { jwt } = service.config;
  try {
    if (JoseWrapper.isJweToken(token)) {
      const { payload } = await service.jwe.decrypt(token, audience);
      return payload;
    }

    // should await here, otherwise jwt.Error thrown
    const decoded = await verifyData(token, jwt, { audience });
    return decoded;
  } catch (e) {
    service.log.debug({ e, jwt }, 'error decoding token');
    throw USERS_INVALID_TOKEN;
  }
}

exports.decodeAndVerify = decodeAndVerify;

const getAudience = (defaultAudience, audience) => {
  if (audience !== defaultAudience) {
    return [audience, defaultAudience];
  }

  return [audience];
};

const nopFn = () => {};

exports.login = async function login(userId, _audience, stateless = false) {
  const { defaultAudience, stateless: { force, enabled } } = this.config.jwt;

  const audience = _audience || defaultAudience;
  const metadataAudience = getAudience(defaultAudience, audience);

  if (stateless) {
    assertStatelessEnabled(this);
  }

  const tokenFlow = enabled && (force || stateless)
    ? (metadata) => statelessJWT.login(this, userId, audience, metadata)
    : (metadata) => legacyJWT.login(this, userId, audience, metadata);

  const metadata = await getMetadata(this, userId, metadataAudience);
  const flowResult = await tokenFlow(metadata);

  return mapJWT(userId, flowResult, metadata);
};

exports.logout = async function logout(token, audience) {
  const decodedToken = await decodeAndVerify(this, token, audience);

  assertRefreshToken(decodedToken);

  await Promise.all([
    legacyJWT.logout(this, token, decodedToken),
    isStatelessEnabled(this)
      ? statelessJWT.logout(this, decodedToken)
      : nopFn,
  ]);

  return { success: true };
};

// Should check old tokens and new tokens
exports.verify = async function verifyToken(service, token, audience, peek) {
  const decodedToken = await decodeAndVerify(service, token, audience);

  if (audience.indexOf(decodedToken.aud) === -1) {
    throw USERS_AUDIENCE_MISMATCH;
  }

  // verify only legacy tokens
  const isStateless = isStatelessToken(decodedToken);
  if (!isStateless) {
    await legacyJWT.verify(service, token, decodedToken, peek);
  }

  // btw if someone passed stateless token
  if (isStateless) {
    assertStatelessEnabled(service);
    await statelessJWT.verify(service, decodedToken);
  }

  return decodedToken;
};

exports.reset = async function reset(userId) {
  const resetResult = await Promise.all([
    statelessJWT.reset(this, userId),
    isStatelessEnabled(this)
      ? legacyJWT.reset(this, userId)
      : nopFn,
  ]);

  return resetResult;
};

exports.refresh = async function refresh(token, _audience) {
  assertStatelessEnabled(this);

  const { defaultAudience } = this.config.jwt;
  const audience = _audience || defaultAudience;

  const decodedToken = await decodeAndVerify(this, token, audience);

  assertRefreshToken(decodedToken);
  await checkToken(this, decodedToken);

  const userId = decodedToken[USERS_USERNAME_FIELD];
  const userData = await fromTokenData(this, { userId }, {
    defaultAudience,
    audience,
  });

  const refreshResult = await statelessJWT.refresh(this, token, decodedToken, audience, userData.metadata[audience]);

  return mapJWT(userId, refreshResult, userData.metadata);
};

const Errors = require('common-errors');
const jose = require('jose');

// internal modules
const redisKey = require('./key');

const { verify: verifyHMAC } = require('./signatures');
const {
  USERS_TOKENS,
  USERS_API_TOKENS,
  USERS_USERNAME_FIELD,
  USERS_MALFORMED_TOKEN,
  BEARER_USERNAME_FIELD,
  BEARER_LEGACY_USERNAME_FIELD,
} = require('../constants');

/**
 * Logs user in and returns JWT and User Object
 * @param  {String}  username
 * @param  {String}  _audience
 * @return {Promise}
 */
exports.login = async function login(service, userId, audience) {
  const { redis, config, flake } = service;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, secret } = jwtConfig;

  // will have iat field, which is when this token was issued
  // we can check last access and verify the expiration date based on it
  const payload = {
    [USERS_USERNAME_FIELD]: userId,
    cs: flake.next(),
    aud: audience,
  };

  const signJwt = new jose.SignJWT(payload);
  const token = await signJwt
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setIssuer('ms-users')
    .sign(Buffer.from(secret));

  const lastAccessUpdated = await redis.zadd(redisKey(userId, USERS_TOKENS), Date.now(), token);

  return {
    lastAccessUpdated,
    userId,
    jwt: token,
  };
};

/**
 * Removes token if it is valid
 * @param  {String} token
 * @param  {String} audience
 * @return {Promise}
 */
exports.logout = async function logout(service, encodedToken, decodedToken) {
  const { redis } = service;
  await redis.zrem(redisKey(decodedToken[USERS_USERNAME_FIELD], USERS_TOKENS), encodedToken);

  return { success: true };
};

/**
 * Removes all issued tokens for a given user
 * @param {String} username
 */
exports.reset = function reset(service, userId) {
  return service.redis.del(redisKey(userId, USERS_TOKENS));
};

/**
 * Verifies token and returns decoded version of it
 * @param  {String} token
 * @param  {Array} audience
 * @param  {Boolean} peek
 * @param  {String} [overrideSecret]
 * @return {Promise}
 */
exports.verify = async function verifyToken(service, encodedToken, token, peek) {
  const jwtConfig = service.config.jwt;

  const username = token[USERS_USERNAME_FIELD];
  const tokensHolder = redisKey(username, USERS_TOKENS);

  const score = (await service.redis.zscore(tokensHolder, encodedToken)) * 1;

  if (score == null || Date.now() > score + jwtConfig.ttl) {
    throw new Errors.HttpStatusError(403, 'token has expired or was forged');
  }

  if (!peek) {
    await service.redis.zadd(tokensHolder, Date.now(), encodedToken);
  }

  return token;
};

/**
 * Verifies internal token
 * @param {String} token
 * @param {Array} audience
 * @param {Boolean} peek
 * @return {Promise}
 */
exports.internal = async function verifyInternalToken(service, token) {
  const tokenParts = token.split('.');

  if (tokenParts.length !== 3) {
    return Promise.reject(USERS_MALFORMED_TOKEN);
  }

  const [userId, uuid, signature] = tokenParts;

  // token is malformed, must be username.uuid.signature
  if (!userId || !uuid || !signature) {
    return Promise.reject(USERS_MALFORMED_TOKEN);
  }

  // md5 hash
  const isLegacyToken = userId.length === 32 && /^[a-fA-F0-9]{32}$/.test(userId);

  // this is needed to pass ctx of the
  const payload = `${userId}.${uuid}`;
  const isValid = verifyHMAC.call(service, payload, signature);

  if (!isValid) {
    return Promise.reject(USERS_MALFORMED_TOKEN);
  }

  // at this point signature is valid and we need to verify that it was not
  // erase or expired
  const key = redisKey(USERS_API_TOKENS, payload);
  const tokenField = isLegacyToken ? BEARER_LEGACY_USERNAME_FIELD : BEARER_USERNAME_FIELD;
  const [id, scopes] = await service.redis.hmget(key, tokenField, 'scopes');

  return {
    [tokenField]: id,
    scopes: scopes ? JSON.parse(scopes) : null,
  };
};

/**
 * Sign data
 * @param  {any} paylaod
 * @param  {Object} tokenOptions
 * @return {Promise}
 */
exports.signData = function signData(payload, tokenOptions) {
  const {
    hashingFunction: algorithm, secret, issuer, extra,
  } = tokenOptions;

  const { expiresIn, ...otherExtra } = extra;

  const signJwt = new jose.SignJWT({
    ...payload,
    ...otherExtra,
  });

  if (expiresIn) {
    signJwt.setExpirationTime(expiresIn);
  }

  return signJwt
    .setProtectedHeader({ alg: algorithm })
    .setIssuedAt()
    .setIssuer(issuer)
    .sign(Buffer.from(secret));
};

exports.verifyData = async function verifyData(token, tokenOptions, extraOpts = {}) {
  const { payload } = await jose.jwtVerify(token, Buffer.from(tokenOptions.secret), {
    ...tokenOptions.extra,
    ...extraOpts,
    issuer: tokenOptions.issuer,
    algorithms: [tokenOptions.hashingFunction],
  });

  return payload;
};

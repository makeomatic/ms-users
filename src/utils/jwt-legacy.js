const Errors = require('common-errors');
const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));

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
  };

  const token = jwt.sign(payload, secret, { algorithm, audience, issuer: 'ms-users' });

  const lastAccessUpdated = await redis.zadd(redisKey(userId, USERS_TOKENS), Date.now(), token);

  return {
    lastAccessUpdated,
    userId,
    jwt: token,
  };
};

/**
 * Erases the token
 */
function eraseToken(decoded) {
  return this.redis.zrem(redisKey(decoded[USERS_USERNAME_FIELD], USERS_TOKENS), this.token);
}

/**
 * Removes token if it is valid
 * @param  {String} token
 * @param  {String} audience
 * @return {Promise}
 */
exports.logout = function logout(service, encodedToken, decodedToken) {
  const { redis } = service;

  return Promise.resolve(decodedToken)
    .bind({ redis, token: encodedToken })
    .then(eraseToken)
    .return({ success: true });
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
    service.redis.zadd(tokensHolder, Date.now(), encodedToken);
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
exports.internal = async function verifyInternalToken(token) {
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
  const isValid = verifyHMAC.call(this, payload, signature);

  if (!isValid) {
    return Promise.reject(USERS_MALFORMED_TOKEN);
  }

  // at this point signature is valid and we need to verify that it was not
  // erase or expired
  const key = redisKey(USERS_API_TOKENS, payload);
  const tokenField = isLegacyToken ? BEARER_LEGACY_USERNAME_FIELD : BEARER_USERNAME_FIELD;
  const id = await this.redis.hget(key, tokenField);

  return {
    [tokenField]: id,
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
  return jwt.sign(payload, secret, { ...extra, algorithm, issuer });
};

exports.verifyData = function verifyData(token, tokenOptions, extraOpts = {}) {
  return jwt.verifyAsync(token, tokenOptions.secret, {
    ...tokenOptions.extra,
    ...extraOpts,
    issuer: tokenOptions.issuer,
    algorithms: [tokenOptions.hashingFunction],
  });
};

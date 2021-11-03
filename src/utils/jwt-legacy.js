const Errors = require('common-errors');
const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));

// internal modules
const redisKey = require('./key');
const getMetadata = require('./get-metadata');
const { verify: verifyHMAC } = require('./signatures');
const {
  USERS_TOKENS,
  USERS_API_TOKENS,
  USERS_ID_FIELD,
  USERS_USERNAME_FIELD,
  USERS_AUDIENCE_MISMATCH,
  USERS_MALFORMED_TOKEN,
  BEARER_USERNAME_FIELD,
  BEARER_LEGACY_USERNAME_FIELD,
} = require('../constants');

// cache this to not recreate all the time
const mapJWT = (props) => ({
  jwt: props.jwt,
  user: {
    [USERS_ID_FIELD]: props.userId,
    metadata: props.metadata,
  },
});

/**
 * Logs user in and returns JWT and User Object
 * @param  {String}  username
 * @param  {String}  _audience
 * @return {Promise}
 */
exports.login = function login(service, userId, _audience) {
  const { redis, config, flake } = service;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, defaultAudience, secret } = jwtConfig;
  let audience = _audience || defaultAudience;

  // will have iat field, which is when this token was issued
  // we can check last access and verify the expiration date based on it
  const payload = {
    [USERS_USERNAME_FIELD]: userId,
    cs: flake.next(),
  };

  const token = jwt.sign(payload, secret, { algorithm, audience, issuer: 'ms-users' });

  if (audience !== defaultAudience) {
    audience = [audience, defaultAudience];
  } else {
    audience = [audience];
  }

  return Promise
    .props({
      lastAccessUpdated: redis.zadd(redisKey(userId, USERS_TOKENS), Date.now(), token),
      jwt: token,
      userId,
      metadata: getMetadata.call(service, userId, audience),
    })
    .then(mapJWT);
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
 * Parse last access
 */
function getLastAccess(_score) {
  // parseResponse
  const score = _score * 1;

  // throw if token not found or expired
  if (_score == null || Date.now() > score + this.ttl) {
    throw new Errors.HttpStatusError(403, 'token has expired or was forged');
  }

  return score;
}

/**
 * Refreshes last access token
 */
function refreshLastAccess() {
  return this.redis.zadd(this.tokensHolder, Date.now(), this.token);
}

/**
 * Verify decoded token
 */
async function verifyDecodedToken(decoded) {
  if (this.audience.indexOf(decoded.aud) === -1) {
    return Promise.reject(USERS_AUDIENCE_MISMATCH);
  }

  const username = decoded[USERS_USERNAME_FIELD];
  const tokensHolder = this.tokensHolder = redisKey(username, USERS_TOKENS);

  const score = await this.redis.zscore(tokensHolder, this.token);
  const lastAccess = await getLastAccess.call(this, score);

  if (!this.peek) {
    await refreshLastAccess.call(this, lastAccess);
  }

  return decoded;
}

/**
 * Verifies token and returns decoded version of it
 * @param  {String} token
 * @param  {Array} audience
 * @param  {Boolean} peek
 * @param  {String} [overrideSecret]
 * @return {Promise}
 */
exports.verify = function verifyToken(service, encodedToken, token, audience, peek) {
  const jwtConfig = service.config.jwt;
  const ctx = {
    audience,
    token: encodedToken,
    peek,
    redis: service.redis,
    log: service.log,
    ttl: jwtConfig.ttl,
  };

  return Promise
    .resolve(token)
    .bind(ctx)
    .then(verifyDecodedToken);
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

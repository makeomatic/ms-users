const Errors = require('common-errors');
const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));

// internal modules
const redisKey = require('./key.js');
const { USERS_TOKENS, USERS_API_TOKENS, USERS_ID_FIELD } = require('../constants.js');
const getMetadata = require('../utils/getMetadata.js');
const { resolveUserId } = require('../utils/userData');
const { verify: verifyHMAC } = require('./signatures');

// cache this to not recreate all the time
const mapJWT = props => ({
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
exports.login = function login(userId, _audience) {
  const { redis, config, flake } = this;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, defaultAudience, secret } = jwtConfig;
  let audience = _audience || defaultAudience;

  // will have iat field, which is when this token was issued
  // we can check last access and verify the expiration date based on it
  const payload = {
    // @TODO comment
    username: userId,
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
      metadata: getMetadata.call(this, userId, audience),
    })
    .then(mapJWT);
};

/**
 * Logs error & then throws
 */
function remapInvalidTokenError(err) {
  this.log.debug('error decoding token', err);
  throw new Errors.HttpStatusError(403, 'invalid token');
}

/**
 * Erases the token
 */
function eraseToken(decoded) {
  return this.redis.zrem(redisKey(decoded.userId, USERS_TOKENS), this.token);
}

/**
 * Removes token if it is valid
 * @param  {String} token
 * @param  {String} audience
 * @return {Promise}
 */
exports.logout = function logout(token, audience) {
  const { redis, config } = this;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, secret, issuer } = jwtConfig;

  return jwt
    .verifyAsync(token, secret, { issuer, audience, algorithms: [algorithm] })
    .bind(this)
    .catch(remapInvalidTokenError)
    .bind({ redis, token })
    .then(eraseToken)
    .return({ success: true });
};

/**
 * Removes all issued tokens for a given user
 * @param {String} username
 */
exports.reset = function reset(userId) {
  return this.redis.del(redisKey(userId, USERS_TOKENS));
};

/**
 * Parse last access
 */
function getLastAccess(_score) {
  // parseResponse
  const score = parseInt(_score, 10);

  // throw if token not found or expired
  if (isNaN(score) || Date.now() > (score + this.ttl)) {
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
function verifyDecodedToken(decoded) {
  if (this.audience.indexOf(decoded.aud) === -1) {
    throw new Errors.HttpStatusError(403, 'audience mismatch');
  }

  // @TODO comment (userId)
  const { username } = decoded;
  const tokensHolder = this.tokensHolder = redisKey(username, USERS_TOKENS);

  let lastAccess = this.redis
    .zscore(tokensHolder, this.token)
    .bind(this)
    .then(getLastAccess);

  if (!this.peek) {
    lastAccess = lastAccess.then(refreshLastAccess);
  }

  return lastAccess.return(decoded);
}

/**
 * Verifies token and returns decoded version of it
 * @param  {String} token
 * @param  {Array} audience
 * @param  {Boolean} peek
 * @return {Promise}
 */
exports.verify = function verifyToken(token, audience, peek) {
  const { redis, config, log } = this;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, secret, ttl, issuer } = jwtConfig;

  return jwt
    .verifyAsync(token, secret, { issuer, algorithms: [algorithm] })
    .bind({ redis, log, ttl, audience, token, peek })
    .catch(remapInvalidTokenError)
    .then(verifyDecodedToken);
};

/**
 * Verifies internal token
 * @param {String} token
 * @param {Array} audience
 * @param {Boolean} peek
 * @return {Promise}
 */
exports.internal = function verifyInternalToken(token) {
  const tokenParts = token.split('.');

  if (tokenParts.length !== 3) {
    throw new Errors.HttpStatusError(403, 'malformed token');
  }

  const [userId, uuid, signature] = tokenParts;

  // token is malformed, must be username.uuid.signature
  if (!userId || !uuid || !signature) {
    throw new Errors.HttpStatusError(403, 'malformed token');
  }

  // this is needed to pass ctx of the
  const payload = `${userId}.${uuid}`;
  const isValid = verifyHMAC.call(this, payload, signature);

  if (!isValid) {
    throw new Errors.HttpStatusError(403, 'malformed token');
  }

  // at this point signature is valid and we need to verify that it was not
  // erase or expired
  const key = redisKey(USERS_API_TOKENS, payload);
  const redis = this.redis;
  const isLegacy = /^[a-f0-9]{32}$/i.test(userId); // is md5?

  if (isLegacy) {
    // @TODO comment, test
    return redis
      .hget(key, 'username')
      .bind(this)
      .then(resolveUserId)
      // @TODO comment
      .then(username => ({ username }));
  }

  return redis
    .hget(key, 'userId')
    // @TODO comment
    .then(username => ({ username }));
};

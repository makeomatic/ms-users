const Errors = require('common-errors');
const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const redisKey = require('./key.js');
const getMetadata = require('../actions/getMetadata.js');
const FlakeId = require('flake-idgen');
const flakeIdGen = new FlakeId();

/**
 * Logs user in and returns JWT and User Object
 * @param  {String}  username
 * @param  {String}  _audience
 * @return {Promise}
 */
exports.login = function login(username, _audience) {
  const { _redis: redis } = this;
  const { hashingFunction: algorithm, defaultAudience, secret } = this._config.jwt;
  let audience = _audience || defaultAudience;

  // will have iat field, which is when this token was issued
  // we can check last access and verify the expiration date based on it
  const payload = {
    username,
    cs: flakeIdGen.next().toString('hex'),
  };

  const token = jwt.sign(payload, secret, { algorithm, audience, issuer: 'ms-users' });

  if (audience !== defaultAudience) {
    audience = [ audience, defaultAudience ];
  } else {
    audience = [ audience ];
  }

  return Promise.props({
    lastAccessUpdated: redis.zadd(redisKey(username, 'tokens'), Date.now(), token),
    jwt: token,
    username,
    metadata: getMetadata.call(this, username, audience),
  })
  .then(function remap(props) {
    return {
      jwt: props.jwt,
      user: {
        username: props.username,
        metadata: props.metadata,
      },
    };
  });
};

/**
 * Removes token if it is valid
 * @param  {String} token
 * @param  {String} audience
 * @return {Promise}
 */
exports.logout = function logout(token, audience) {
  const { _redis: redis, _config: config } = this;
  const { hashingFunction: algorithm, secret, issuer } = config.jwt;

  return jwt
    .verifyAsync(token, secret, { issuer, audience, algorithms: [ algorithm ] })
    .catch((err) => {
      this.log.debug('error decoding token', err);
      throw new Errors.HttpStatusError(403, 'Invalid Token');
    })
    .then(function decodedToken(decoded) {
      return redis.zrem(redisKey(decoded.username, 'tokens'), token);
    })
    .return({ success: true });
};

/**
 * Removes all issued tokens for a given user
 * @param {String} username
 */
exports.reset = function reset(username) {
  const { _redis: redis } = this;
  return redis.del(redisKey(username, 'tokens'));
};

/**
 * Verifies token and returns decoded version of it
 * @param  {String}       token
 * @param  {Array} audience
 * @param  {Boolean}      peek
 * @return {Promise}
 */
exports.verify = function verifyToken(token, audience, peek) {
  const { _redis: redis, _config: config } = this;
  const { hashingFunction: algorithm, secret, ttl, issuer } = config.jwt;

  return jwt
    .verifyAsync(token, secret, { issuer, algorithms: [ algorithm ] })
    .catch((err) => {
      this.log.debug('invalid token passed: %s', token, err);
      throw new Errors.HttpStatusError(403, 'invalid token');
    })
    .then(function decodedToken(decoded) {
      if (audience.indexOf(decoded.aud) === -1) {
        throw new Errors.HttpStatusError(403, 'audience mismatch');
      }

      const { username } = decoded;
      const tokensHolder = redisKey(username, 'tokens');
      let lastAccess = redis.zscoreBuffer(tokensHolder, token).then(function getLastAccess(_score) {
        // parseResponse
        const score = parseInt(_score, 10);

        // throw if token not found or expired
        if (isNaN(score) || Date.now() > score + ttl) {
          throw new Errors.HttpStatusError(403, 'token has expired or was forged');
        }

        return score;
      });

      if (!peek) {
        lastAccess = lastAccess.then(function refreshLastAccess() {
          return redis.zadd(tokensHolder, Date.now(), token);
        });
      }

      return lastAccess.return(decoded);
    });
};

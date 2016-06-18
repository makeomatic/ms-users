const Errors = require('common-errors');
const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const getMetadata = require('../utils/getMetadata.js');
const FlakeId = require('flake-idgen');
const flakeIdGen = new FlakeId();
const Users = require('../db/adapter');

/**
 * Logs user in and returns JWT and User Object
 * @param  {String}  username
 * @param  {String}  _audience
 * @return {Promise}
 */
exports.login = function login(username, _audience) {
  const { config } = this;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, defaultAudience, secret } = jwtConfig;
  let audience = _audience || defaultAudience;

  // will have iat field, which is when this token was issued
  // we can check last access and verify the expiration date based on it
  const payload = {
    username,
    cs: flakeIdGen.next().toString('hex'),
  };

  const token = jwt.sign(payload, secret, { algorithm, audience, issuer: 'ms-users' });

  if (audience !== defaultAudience) {
    audience = [audience, defaultAudience];
  } else {
    audience = [audience];
  }

  return Promise.props({
    lastAccessUpdated: Users.addToken(username, token),
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
  const { config } = this;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, secret, issuer } = jwtConfig;

  return jwt
    .verifyAsync(token, secret, { issuer, audience, algorithms: [algorithm] })
    .catch(err => {
      this.log.debug('error decoding token', err);
      throw new Errors.HttpStatusError(403, 'Invalid Token');
    })
    .then(function decodedToken(decoded) {
      return Users.dropToken(decoded.username, token);
    })
    .return({ success: true });
};

/**
 * Removes all issued tokens for a given user
 * @param {String} username
 */
exports.reset = function reset(username) {
  return Users.dropToken(username);
};

/**
 * Verifies token and returns decoded version of it
 * @param  {String}       token
 * @param  {Array} audience
 * @param  {Boolean}      peek
 * @return {Promise}
 */
exports.verify = function verifyToken(token, audience, peek) {
  const { config } = this;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, secret, issuer } = jwtConfig;

  return jwt
    .verifyAsync(token, secret, { issuer, algorithms: [algorithm] })
    .catch(err => {
      this.log.debug('invalid token passed: %s', token, err);
      throw new Errors.HttpStatusError(403, 'invalid token');
    })
    .then(function decodedToken(decoded) {
      if (audience.indexOf(decoded.aud) === -1) {
        throw new Errors.HttpStatusError(403, 'audience mismatch');
      }

      const { username } = decoded;
      let lastAccess = Users.lastAccess(username, token);

      if (!peek) {
        lastAccess = lastAccess.then(function refreshLastAccess() {
          return Users.addToken(username, token);
        });
      }

      return lastAccess.return(decoded);
    });
};

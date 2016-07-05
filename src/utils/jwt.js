const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const FlakeId = require('flake-idgen');
const noop = require('lodash/noop');
const flakeIdGen = new FlakeId();
const { User, Tokens } = require('../model/usermodel');
const { ModelError, ERR_TOKEN_INVALID, ERR_TOKEN_AUDIENCE_MISMATCH } = require('../model/modelError');

// TODO: merge this code with master!!!

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
    lastAccessUpdated: Tokens.add.call(this, username, token),
    jwt: token,
    username,
    metadata: User.getMeta.call(this, username, audience),
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
      throw new ModelError(ERR_TOKEN_INVALID);
    })
    .then(decoded => {
      return Tokens.drop.call(this, decoded.username, token);
    })
    .return({ success: true });
};

/**
 * Removes all issued tokens for a given user
 * @param {String} username
 */
exports.reset = function reset(username) {
  return Tokens.drop(username);
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
      throw new ModelError(ERR_TOKEN_INVALID);
    })
    .then(function decodedToken(decoded) {
      if (audience.indexOf(decoded.aud) === -1) {
        throw new ModelError(ERR_TOKEN_AUDIENCE_MISMATCH);
      }

      const { username } = decoded;
      const lastAccess = Tokens
        .lastAccess(username, token)
        .then(peek ? () => Tokens.add(username, token) : noop);

      return lastAccess.return(decoded);
    });
};

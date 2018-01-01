/**
 * Performs JWT token verification
 * @param  {string} token
 * @returns {Promise}
 */
exports.verifyToken = function verifyToken(token) {
  const { amqp, config } = this;
  const { prefix } = config.router.routes;
  const audience = config.jwt.defaultAudience;
  const payload = {
    token,
    audience,
  };

  return amqp.publishAndWait(`${prefix}.verify`, payload);
};

/**
 * Attempts to sign in with a registered user
 * @param  {string} username
 * @returns {Promise}
 */
exports.loginAttempt = function loginAttempt(username, opts = {}) {
  const { amqp, config } = this;
  const { prefix } = config.router.routes;
  const audience = config.jwt.defaultAudience;
  const payload = {
    username,
    audience,
    isSSO: true,
    ...opts,
  };

  return amqp.publishAndWait(`${prefix}.login`, payload);
};

const { AuthenticationRequiredError } = require('common-errors');

function getAuthToken(authHeader) {
  const [auth, token] = authHeader.trim().split(/\s+/, 2).map(str => str.trim());

  if (auth == null) {
    throw new AuthenticationRequiredError('Auth type must be present');
  }

  if (auth !== 'JWT') {
    throw new AuthenticationRequiredError(`Invalid auth type ${auth}`);
  }

  if (token == null) {
    throw new AuthenticationRequiredError('Token must be present');
  }

  return token;
}

function tokenAuth({ headers }) {
  const { authorization } = headers;

  if (authorization) {
    const { amqp, config } = this;
    const { users: { audience, verify, timeouts } } = config;
    const token = getAuthToken(authorization);
    const timeout = timeouts.verify;

    return amqp
      .publishAndWait(verify, { token, audience }, { timeout })
      .then((response) => {
        const { username, metadata } = response;

        // unwrap meta right away
        return { username, metadata: metadata[audience] };
      });
  }

  return null;
}

module.exports = tokenAuth;

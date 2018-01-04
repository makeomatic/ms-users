const Promise = require('bluebird');
const { AuthenticationRequiredError, HttpStatusError } = require('common-errors');

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

function tokenAuth(request) {
  const { method, action } = request;
  const { auth } = action;
  const { strategy = 'required' } = auth;

  // NOTE: should normalize on the ~transport level
  // select actual headers location based on the transport
  const headers = method === 'amqp' ? request.headers.headers : request.headers;
  const authHeader = headers.authorization;

  if (authHeader) {
    const token = getAuthToken(authHeader);
    const params = method === 'get' ? request.query : request.params;
    const { amqp, config } = this;
    const { users: { audience: defaultAudience, verify, timeouts } } = config;
    const timeout = timeouts.verify;
    const audience = params.audience || defaultAudience;

    return amqp.publishAndWait(verify, { token, audience }, { timeout });
  } else if (strategy === 'required') {
    return Promise.reject(new HttpStatusError(401, 'Credentials Required'));
  }

  return null;
}

module.exports = tokenAuth;

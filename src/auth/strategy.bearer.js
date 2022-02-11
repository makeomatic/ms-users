const Promise = require('bluebird');
const is = require('is');
const { AuthenticationRequiredError } = require('common-errors');
const { USERS_CREDENTIALS_REQUIRED_ERROR } = require('../constants');

function getAuthToken(authHeader) {
  const [auth, token] = authHeader.trim().split(/\s+/, 2).map((str) => str.trim());

  if (auth == null) {
    throw new AuthenticationRequiredError('Auth type must be present');
  }

  if (token == null) {
    throw new AuthenticationRequiredError('Token must be present');
  }

  switch (auth) {
    case 'JWT':
      return { accessToken: false, token };

    case 'Bearer':
      return { accessToken: true, token };

    default:
      throw new AuthenticationRequiredError(`Invalid auth type ${auth}`);
  }
}

function tokenAuth(request) {
  const { method, action } = request;
  const { auth } = action;
  const { strategy = 'required' } = auth;

  // NOTE: should normalize on the ~transport level
  // select actual headers location based on the transport
  const headers = method === 'amqp' ? request.headers.headers : request.headers;
  const authHeader = headers ? headers.authorization : null;

  if (authHeader) {
    const params = method === 'get' ? request.query : request.params;
    const { accessToken, token } = getAuthToken(authHeader);
    const { amqp, config } = this;
    const { users: { audience: defaultAudience, verify, timeouts } } = config;
    const timeout = timeouts.verify;
    const audience = (is.object(params) && params.audience) || defaultAudience;

    return amqp.publishAndWait(verify, { token, audience, accessToken }, { timeout });
  }

  if (strategy === 'required') {
    return Promise.reject(USERS_CREDENTIALS_REQUIRED_ERROR);
  }

  return null;
}

module.exports = tokenAuth;

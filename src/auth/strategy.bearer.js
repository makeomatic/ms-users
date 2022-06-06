const Promise = require('bluebird');
const is = require('is');

const { AuthenticationRequiredError } = require('common-errors');
const { USERS_CREDENTIALS_REQUIRED_ERROR, USERS_INVALID_TOKEN } = require('../constants');
const { hasTrustedHeader, checkTrustedHeadersCompat, hasStatelessToken } = require('../utils/stateless-jwt/trusted-headers');

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

    case 'Signature':
      return { requestSignature: true };

    default:
      throw new AuthenticationRequiredError(`Invalid auth type ${auth}`);
  }
}

async function validateSignature(service, request, audience) {
  const { amqp, config } = service;
  const { users: { verifyRequestSignature, timeouts } } = config;

  return amqp.publishAndWait(
    verifyRequestSignature,
    { audience, request },
    { timeout: timeouts.verifyRequestSignature }
  );
}

function validateToken(service, token, accessToken, audience) {
  const { amqp, config } = service;
  const { users: { verify, timeouts } } = config;
  const timeout = timeouts.verify;

  return amqp.publishAndWait(verify, { token, audience, accessToken }, { timeout });
}

function checkTokenHeader(service, strategy, reqInfo, audience) {
  const { headers } = reqInfo;
  const authHeader = headers ? headers.authorization : null;

  if (authHeader) {
    const { accessToken, token, requestSignature } = getAuthToken(authHeader);
    if (requestSignature) {
      return validateSignature(service, reqInfo, audience).catch((error) => {
        service.log.error({ error }, 'signature validation error');
        throw USERS_INVALID_TOKEN;
      });
    }

    return validateToken(service, token, accessToken, audience);
  }

  if (strategy === 'required') {
    return Promise.reject(USERS_CREDENTIALS_REQUIRED_ERROR);
  }

  return null;
}

function tokenAuth(request) {
  const { method, action, transport } = request;
  const { auth } = action;
  const { strategy = 'required' } = auth;
  const { config } = this;
  const { users: { audience: defaultAudience } } = config;

  // NOTE: should normalize on the ~transport level
  // select actual headers location based on the transport
  const headers = method === 'amqp' ? request.headers.headers : request.headers;

  // extract url + search params for signinature check
  const url = transport === 'http'
    ? `${request.transportRequest.url.pathname}${request.transportRequest.url.search}`
    : action.actionName;

  const params = method === 'get' ? request.query : request.params;
  const audience = (is.object(params) && params.audience) || defaultAudience;

  // extract post params that not a part of query string
  const requestInfo = { headers, params: request.params, method, url };

  if (hasTrustedHeader(headers) && hasStatelessToken(headers)) {
    // fallback fn is required to handle the case of the offline ingress token backend
    return checkTrustedHeadersCompat(
      this,
      headers,
      { audience },
      () => checkTokenHeader(this, strategy, requestInfo, audience)
    );
  }

  return checkTokenHeader(this, strategy, requestInfo, audience);
}

tokenAuth.validateSignature = validateSignature;

module.exports = tokenAuth;

const Promise = require('bluebird');
const is = require('is');
const { parseRequest, verifyHMAC } = require('http-signature');
const { createHmac } = require('crypto');

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

// @TODO validation header configuration + etc
async function validateSignature(service, headers, params) {
  const { amqp, config } = service;
  const { users: { verifyKey, timeouts } } = config;

  const signature = parseRequest({ headers });
  const { signKey: key, ...validateResult } = await amqp.publishAndWait(
    verifyKey,
    { keyId: signature.keyId },
    { timeout: timeouts.verifyKey }
  );

  if (!verifyHMAC(signature, key)) {
    throw USERS_INVALID_TOKEN;
  }

  if (params) {
    const hmac = createHmac(signature.algorithm, key);
    hmac.update(JSON.stringify(params));

    if (headers.digest !== hmac.digest('hex')) {
      throw USERS_INVALID_TOKEN;
    }
  }

  return validateResult;
}

function validateToken(service, params, token, accessToken) {
  const { amqp, config } = service;
  const { users: { audience: defaultAudience, verify, timeouts } } = config;
  const timeout = timeouts.verify;
  const audience = (is.object(params) && params.audience) || defaultAudience;

  return amqp.publishAndWait(verify, { token, audience, accessToken }, { timeout });
}

function checkTokenHeader(service, strategy, params, headers) {
  const authHeader = headers ? headers.authorization : null;

  if (authHeader) {
    const { accessToken, token, requestSignature } = getAuthToken(authHeader);
    if (requestSignature) {
      return validateSignature(service, headers, params).catch((error) => {
        service.log.error({ error }, 'signature validation error');
        throw USERS_INVALID_TOKEN;
      });
    }

    return validateToken(service, params, token, accessToken);
  }

  if (strategy === 'required') {
    return Promise.reject(USERS_CREDENTIALS_REQUIRED_ERROR);
  }

  return null;
}

function tokenAuth(request) {
  const { method, action } = request;
  const { auth } = action;
  const { strategy = 'required' } = auth;

  // NOTE: should normalize on the ~transport level
  // select actual headers location based on the transport
  const headers = method === 'amqp' ? request.headers.headers : request.headers;
  const params = method === 'get' ? request.query : request.params;

  if (hasTrustedHeader(headers) && hasStatelessToken(headers)) {
    // fallback fn is required to handle the case of the offline ingress token backend
    return checkTrustedHeadersCompat(
      this,
      headers,
      params,
      () => checkTokenHeader(this, strategy, params, headers)
    );
  }

  return checkTokenHeader(this, strategy, params, headers);
}

module.exports = tokenAuth;

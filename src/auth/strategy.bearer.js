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

async function validateSignature(service, reqInfo) {
  const { headers, params, requestParams } = reqInfo;
  const { amqp, config } = service;
  const { users: { audience: defaultAudience, verifyKey, timeouts }, auth: { signedRequest } } = config;
  const audience = (is.object(params) && params.audience) || defaultAudience;

  const signature = parseRequest(reqInfo, {
    strict: true,
    headers: signedRequest.headers,
    clockSkew: signedRequest.clockSkew,
  });

  const tokenInfo = await amqp.publishAndWait(
    verifyKey,
    { keyId: signature.keyId, audience },
    { timeout: timeouts.verifyKey }
  );

  const { signKey, ...validateResult } = tokenInfo;

  if (!verifyHMAC(signature, signKey)) {
    throw USERS_INVALID_TOKEN;
  }

  if (requestParams) {
    const algo = signature.algorithm.split('-')[1];
    const hmac = createHmac(algo, signKey);
    hmac.update(JSON.stringify(requestParams));
    const digest = hmac.digest(signedRequest.digest);

    if (headers.digest !== digest) {
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

function checkTokenHeader(service, strategy, reqInfo) {
  const { headers, params } = reqInfo;
  const authHeader = headers ? headers.authorization : null;

  if (authHeader) {
    const { accessToken, token, requestSignature } = getAuthToken(authHeader);
    if (requestSignature) {
      return validateSignature(service, reqInfo).catch((error) => {
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
  const { method, action, transport } = request;
  const { auth } = action;
  const { strategy = 'required' } = auth;

  // NOTE: should normalize on the ~transport level
  // select actual headers location based on the transport
  const headers = method === 'amqp' ? request.headers.headers : request.headers;
  // extract url + search params for signinature check
  const url = transport === 'http'
    ? `${request.transportRequest.url.pathname}${request.transportRequest.url.search}`
    : action.actionName;
  const params = method === 'get' ? request.query : request.params;
  // extract post params that not a part of query string
  const requestParams = request.params;

  if (hasTrustedHeader(headers) && hasStatelessToken(headers)) {
    // fallback fn is required to handle the case of the offline ingress token backend
    return checkTrustedHeadersCompat(
      this,
      headers,
      params,
      () => checkTokenHeader(this, strategy, { headers, params, requestParams, method, url })
    );
  }

  return checkTokenHeader(this, strategy, { headers, params, requestParams, method, url });
}

tokenAuth.validateSignature = validateSignature;

module.exports = tokenAuth;

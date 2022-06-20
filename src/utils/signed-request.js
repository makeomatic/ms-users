const { parseRequest, verifyHMAC } = require('http-signature');
const { createHmac } = require('crypto');

const { USERS_INVALID_TOKEN } = require('../constants');
const { getToken } = require('./api-token');

function getSignature(service, request) {
  const { config } = service;
  const { auth: { signedRequest } } = config;

  try {
    return parseRequest(request, {
      strict: true,
      headers: signedRequest.headers,
      clockSkew: signedRequest.clockSkew,
    });
  } catch (error) {
    service.log.error({ error }, 'unable to parse request signature');
    throw USERS_INVALID_TOKEN;
  }
}

async function validateRequestSignature(service, request) {
  const { config } = service;
  const { auth: { signedRequest } } = config;
  const { headers, params } = request;

  if (headers['x-auth-url']) {
    request.url = headers['x-auth-url'];
    request.method = headers['x-auth-method'];
  }

  const signature = getSignature(service, request);
  const tokenData = await getToken(service, signature.keyId, true);
  const { raw: signKey, type, scopes = [] } = tokenData;

  if (type !== 'sign' || !verifyHMAC(signature, signKey)) {
    service.log.error({ signKey, type, scopes }, 'invalid headers signature');
    throw USERS_INVALID_TOKEN;
  }

  if (params && request.method.toLowerCase() !== 'get') {
    const algo = signature.algorithm.split('-')[1];
    const hmac = createHmac(algo, signKey);
    hmac.update(JSON.stringify(params));

    const digest = hmac.digest(signedRequest.payloadDigest);
    if (headers.digest !== digest) {
      service.log.error({ headersDigest: headers.digest, digest, signedRequest }, 'invalid payload signature');
      throw USERS_INVALID_TOKEN;
    }
  }

  const [userId] = signature.keyId.split('.');

  return { signKey, userId, scopes };
}

module.exports = {
  validateRequestSignature,
};

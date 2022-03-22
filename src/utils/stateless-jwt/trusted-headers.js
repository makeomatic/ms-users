const { ConnectionError, TypeError } = require('common-errors');

const {
  USERS_INVALID_TOKEN,
  USERS_ID_FIELD,
  USERS_AUDIENCE_MISMATCH,
} = require('../../constants');

const X_TOKEN_CHECK_HEADER = 'x-tkn-valid';
const X_TOKEN_REASON_HEADER = 'x-tkn-reason';
const X_TOKEN_BODY_HEADER = 'x-tkn-body';
const X_TOKEN_STATELESS = 'x-tkn-stateless';
const X_TOKEN_VALID = 1;

/** HaProxy specific reason. Passed when `TokenServer` is down or no response received in time. */
const E_BACKEND_UNAVAIL = 'E_BACKEND_UNAVAIL';

const reasonMap = {
  E_TKN_INVALID: USERS_INVALID_TOKEN,
  E_AUD_MISMATCH: USERS_INVALID_TOKEN,
  E_BACKEND_UNAVAIL: new ConnectionError('trusted backend unavailable'),
};

function remapReason(reason) {
  return reasonMap[reason] || new TypeError(`unknown reason '${reason}' received`);
}

function hasTrustedHeader(headers) {
  return !!headers[X_TOKEN_CHECK_HEADER];
}

function hasStatelessToken(headers) {
  return !!headers[X_TOKEN_STATELESS];
}

function isValid(headers) {
  return parseInt(headers[X_TOKEN_CHECK_HEADER], 10) === X_TOKEN_VALID;
}

/**
 * Mimics legacy `users.verify` endpoint and returns same response.
 * The main difference is that JWT verification process is omitted.
 *
 * NOTE: Should not be used with Redis tokens.
 * @param {Object<string, any>} headers
 */
function checkTrustedHeadersCompat(service, headers, { audience }, fallback) {
  const { users: { trustedVerify, timeouts } } = service.config;
  const { amqp } = service;

  if (isValid(headers)) {
    return amqp.publishAndWait(
      trustedVerify,
      {
        jsonToken: headers[X_TOKEN_BODY_HEADER],
        audience,
      },
      { timeout: timeouts.trustedVerify }
    );
  }

  const reason = headers[X_TOKEN_REASON_HEADER];
  if ((reason === E_BACKEND_UNAVAIL || !hasStatelessToken(headers)) && fallback) {
    return fallback();
  }

  throw remapReason(headers[X_TOKEN_REASON_HEADER]);
}

/**
 * Returns ONLY JWT encoded User metadata and ID.
 *
 * NOTE: Should not be used with Redis tokens.
 * @param {Object<string, any>} headers
 */
function checkTrustedHeaders(headers, { audience }, fallback) {
  if (isValid(headers) && hasStatelessToken(headers)) {
    const tokenBody = JSON.parse(headers[X_TOKEN_BODY_HEADER]);

    if (audience.indexOf(tokenBody.aud) === -1) {
      throw USERS_AUDIENCE_MISMATCH;
    }

    return {
      id: tokenBody[USERS_ID_FIELD],
      metadata: tokenBody.metadata,
    };
  }

  const reason = headers[X_TOKEN_REASON_HEADER];
  if ((reason === E_BACKEND_UNAVAIL || !hasStatelessToken(headers)) && fallback) {
    return fallback();
  }

  throw remapReason(headers[X_TOKEN_REASON_HEADER]);
}

module.exports = {
  checkTrustedHeadersCompat,
  checkTrustedHeaders,
  hasTrustedHeader,
  hasStatelessToken,
};

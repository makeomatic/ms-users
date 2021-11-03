const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const { HttpStatusError } = require('common-errors');

const {
  USERS_USERNAME_FIELD,
  USERS_ID_FIELD,
  USERS_INVALID_TOKEN,
} = require('../constants');

const mapJWT = (props) => ({
  jwt: props.jwt,
  jwtRefresh: props.jwtRefresh,
  user: {
    [USERS_ID_FIELD]: props.userId,
    metadata: props.metadata,
  },
});

const isStatelessToken = (token) => !!token.st;

const assertAccessToken = (token) => {
  if (token.st && token.irt) {
    throw new HttpStatusError(401, 'access token required');
  }
};

const assertRefreshToken = (token) => {
  if (token.st && !token.irt) {
    throw new HttpStatusError(401, 'refresh token required');
  }
};

function createToken(service, audience, payload) {
  const { config, flake } = service;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, secret, issuer } = jwtConfig;

  const cs = flake.next();

  const finalPayload = {
    ...payload,
    cs,
    iat: Date.now(),
    st: 1,
  };

  return {
    token: jwt.sign(finalPayload, secret, { algorithm, audience, issuer }),
    cs,
  };
}

function createRefreshToken(service, payload, audience) {
  const ttl = Date.now() + service.config.jwt.refreshTTL;
  return createToken(service, audience, {
    ...payload,
    exp: ttl,
    irt: 1,
  });
}

function createAccessToken(service, refreshToken, payload, audience) {
  const ttl = Date.now() + service.config.jwt.ttl;

  return createToken(service, audience, {
    ...payload,
    // should not exceed refreshToken exp
    exp: ttl > refreshToken.exp ? refreshToken.exp : ttl,
    // refresh token id
    rt: refreshToken.cs,
  });
}

async function login(service, userId, audience) {
  const payload = {
    [USERS_USERNAME_FIELD]: userId,
  };

  const { token: jwtRefresh } = createRefreshToken(service, payload, audience);
  const { token: accessToken } = createAccessToken(service, jwtRefresh, payload, audience);

  return {
    jwt: accessToken,
    jwtRefresh,
    userId,
  };
}

async function refresh(service, token, audience) {
  const userId = token[USERS_USERNAME_FIELD];
  const props = await login(service, userId, audience);

  // -- invalidate previous refresh token and mark all issued access tokens as invalid
  // set user rule { rt: token.cs } || { cs: token.cs }

  return mapJWT(props);
}

// eslint-disable-next-line no-unused-vars
async function logout(_service, token) {
  assertRefreshToken(token);

  // -- invalidate current refresh token and all tokens issued by this refresh token
  // set user rule { cs: { in: [verifiedToken.cs, verifiedToken.rt] }
  return { success: true };
}

async function verify(_service, decodedToken) {
  assertAccessToken(decodedToken);

  // radix verify
  const ruleCheck = false;

  if (ruleCheck) {
    throw USERS_INVALID_TOKEN;
  }

  return decodedToken;
}

// eslint-disable-next-line no-unused-vars
async function reset(_service, _userId) {
  // set user rule { userId, iat: Date.now() } | { userId, rt: null }
  // last one invalidates all legacy tokens for user
}

module.exports = {
  login,
  logout,
  verify,
  reset,
  refresh,
  assertRefreshToken,
  assertAccessToken,
  isStatelessToken,
};

const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const { HttpStatusError } = require('common-errors');

const {
  USERS_USERNAME_FIELD,
  USERS_INVALID_TOKEN,
} = require('../constants');
const { GLOBAL_RULE_PREFIX, USER_RULE_PREFIX } = require('./revocation-rules-manager');

const REVOKE_RULE_UPDATE_ACTION = 'revoke-rule.update';

const isStatelessToken = (token) => !!token.st;

const assertAccessToken = (token) => {
  if (isStatelessToken(token) && token.irt) {
    throw new HttpStatusError(401, 'access token required');
  }
};

const assertRefreshToken = (token) => {
  if (isStatelessToken(token) && typeof token.irt !== 'number') {
    throw new HttpStatusError(401, 'refresh token required');
  }
};

const isStatelessEnabled = (service) => {
  const { jwt: { stateless: { enabled } } } = service.config;
  return enabled;
};

const assertStatelessEnabled = (service) => {
  if (!isStatelessEnabled(service)) {
    throw new HttpStatusError(501, '`Stateless JWT` should be enabled');
  }
};

const createRule = async (service, ruleSpec) => {
  return service.dispatch(REVOKE_RULE_UPDATE_ACTION, { params: ruleSpec });
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
    payload: finalPayload,
  };
}

function createRefreshToken(service, payload, audience) {
  const ttl = Date.now() + service.config.jwt.stateless.refreshTTL;
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

  const { token: jwtRefresh, payload: jwtRefreshPayload } = createRefreshToken(service, payload, audience);
  const { token: accessToken } = createAccessToken(service, jwtRefreshPayload, payload, audience);

  return {
    jwt: accessToken,
    jwtRefresh,
    userId,
  };
}

async function checkRules(service, token) {
  const userId = token[USERS_USERNAME_FIELD];

  const ruleCheck = service.revocationRulesStorage
    .getFilter()
    .match([GLOBAL_RULE_PREFIX, `${USER_RULE_PREFIX}${userId}/`], token);

  if (ruleCheck) {
    throw USERS_INVALID_TOKEN;
  }
}

async function refresh(service, encodedToken, token, audience) {
  const userId = token[USERS_USERNAME_FIELD];

  const payload = {
    [USERS_USERNAME_FIELD]: userId,
  };

  await checkRules(service, token);

  const { token: accessToken, payload: accessTokenPayload } = createAccessToken(service, token, payload, audience[0]);

  // -- invalidate all issued access tokens as invalid that was signed by provided refreshToken
  await createRule(service, {
    username: userId,
    rule: {
      params: {
        ttl: token.exp,
        rt: token.cs,
        iat: { lt: accessTokenPayload.iat },
      },
    },
  });

  return {
    jwt: accessToken,
    jwtRefresh: encodedToken,
    userId,
  };
}

async function logout(service, token) {
  assertRefreshToken(token);

  // -- invalidate current refresh token and all tokens issued by this refresh token
  // set user rule { cs: { in: [verifiedToken.cs, verifiedToken.rt] }
  // -- legacy tokens do not have exp or iat field so ttl of the rule is set to max possible ttl
  const now = Date.now();
  await createRule(service, {
    username: token[USERS_USERNAME_FIELD],
    rule: {
      params: {
        ttl: token.exp || now + service.config.jwt.ttl,
        _or: true,
        cs: token.cs,
        rt: token.cs,
      },
    },
  });

  return { success: true };
}

async function verify(service, decodedToken) {
  assertAccessToken(decodedToken);

  await checkRules(service, decodedToken);

  return decodedToken;
}

async function reset(service, userId) {
  // set user rule { userId, iat: Date.now() }
  // last one invalidates all legacy tokens for user
  await createRule(service, {
    username: userId,
    params: {
      iat: { lte: Date.now() },
    },
  });
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
  isStatelessEnabled,
  assertStatelessEnabled,
};

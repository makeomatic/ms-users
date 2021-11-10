const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));
const { HttpStatusError, ValidationError } = require('common-errors');

const {
  USERS_USERNAME_FIELD,
  USERS_INVALID_TOKEN,
} = require('../constants');
const { GLOBAL_RULE_PREFIX, USER_RULE_PREFIX } = require('./revocation-rules-manager');

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

const storageEnabled = (service) => {
  return !!service.revocationRulesStorage;
};

const managerEnabled = (service) => {
  return !!service.revocationRulesManager;
};

const assertJWTConfig = (config) => {
  const { jwt: { forceStateless }, revocationRulesManager, revocationRulesStorage } = config;
  if (forceStateless && (!revocationRulesManager.enabled || !revocationRulesStorage.enabled)) {
    throw new ValidationError('`revocationRulesManager` and `revocationRulesStorage` should be enabled');
  }
};

const assertStatelessJWTPossible = (service) => {
  if (!storageEnabled(service) || !managerEnabled(service)) {
    throw new HttpStatusError(501, '`revocationRulesManager` and `revocationRulesStorage` should be enabled');
  }
};

// TODO dispatch/direct/publish call??
const createRule = async (service, ruleSpec) => {
  return service.dispatch('revoke-rule.update', { params: ruleSpec });
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

  const { token: jwtRefresh, payload: jwtRefreshPayload } = createRefreshToken(service, payload, audience);
  const { token: accessToken } = createAccessToken(service, jwtRefreshPayload, payload, audience);

  return {
    jwt: accessToken,
    jwtRefresh,
    userId,
  };
}

async function checkRules(service, token) {
  if (storageEnabled(service)) {
    const userId = token[USERS_USERNAME_FIELD];
    const filter = service.revocationRulesStorage.getFilter();

    const ruleCheck = filter.match([GLOBAL_RULE_PREFIX, `${USER_RULE_PREFIX}${userId}`], token);

    if (ruleCheck) {
      throw USERS_INVALID_TOKEN;
    }
  }
}

async function refresh(service, encodedToken, token, audience) {
  const userId = token[USERS_USERNAME_FIELD];

  const payload = {
    [USERS_USERNAME_FIELD]: userId,
  };

  await checkRules(service, token);

  const { token: accessToken } = createAccessToken(service, token, payload, audience);

  if (managerEnabled(service)) {
    // -- invalidate all issued access tokens as invalid that was signed by provided refreshToken
    await createRule(service, {
      username: userId,
      rule: {
        params: {
          ttl: token.iat,
          rt: token.cs,
          iat: { lte: Date.now() },
        },
      },
    });
  }

  return {
    jwt: accessToken,
    jwtRefresh: encodedToken,
    userId,
  };
}

async function logout(service, token) {
  assertRefreshToken(token);

  if (managerEnabled(service)) {
    // -- invalidate current refresh token and all tokens issued by this refresh token
    // set user rule { cs: { in: [verifiedToken.cs, verifiedToken.rt] }
    await createRule(service, {
      username: token[USERS_USERNAME_FIELD],
      rule: {
        params: {
          ttl: token.iat,
          _or: true,
          cs: token.cs,
          rt: token.cs,
        },
      },
    });
  }

  return { success: true };
}

async function verify(service, decodedToken) {
  assertAccessToken(decodedToken);

  await checkRules(service, decodedToken);

  return decodedToken;
}

async function reset(service, userId) {
  if (managerEnabled(service)) {
    // set user rule { userId, iat: Date.now() }
    // last one invalidates all legacy tokens for user
    await createRule(service, {
      username: userId,
      params: {
        iat: Date.now,
      },
    });
  }
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
  managerEnabled,
  storageEnabled,
  assertStatelessJWTPossible,
  assertJWTConfig,
};

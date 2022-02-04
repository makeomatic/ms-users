const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));

const {
  USERS_USERNAME_FIELD,
  USERS_JWT_EXPIRED,
  USERS_JWT_ACCESS_REQUIRED,
  USERS_JWT_REFRESH_REQUIRED,
  USERS_JWT_STATELESS_REQUIRED,
  USERS_INVALID_TOKEN,
} = require('../constants');
const { GLOBAL_RULE_PREFIX, USER_RULE_PREFIX } = require('./revocation-rules-manager');

const REVOKE_RULE_UPDATE_ACTION = 'revoke-rule.update';

const isStatelessToken = (token) => !!token.st;

const assertAccessToken = (token) => {
  if (isStatelessToken(token) && token.irt) {
    throw USERS_JWT_ACCESS_REQUIRED;
  }
};

const assertRefreshToken = (token) => {
  if (isStatelessToken(token) && typeof token.irt !== 'number') {
    throw USERS_JWT_REFRESH_REQUIRED;
  }
};

const isStatelessEnabled = (service) => {
  const { jwt: { stateless: { enabled } } } = service.config;
  return enabled;
};

const assertStatelessEnabled = (service) => {
  if (!isStatelessEnabled(service)) {
    throw USERS_JWT_STATELESS_REQUIRED;
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

  if (ruleCheck === true) {
    throw USERS_INVALID_TOKEN;
  }
}

function refreshTokenStrategy(service, token, encodedRefreshToken, payload, audience) {
  const { refreshRotation: { enabled, always, interval } } = service.config.jwt.stateless;

  if (enabled && (always || (Date.now() > token.exp - interval))) {
    const refreshTkn = createRefreshToken(service, payload, audience);
    const access = createAccessToken(service, refreshTkn.payload, payload, audience);

    return {
      access,
      refresh: refreshTkn,
    };
  }

  return {
    access: createAccessToken(service, token, payload, audience),
    refresh: {
      token: encodedRefreshToken,
      payload: token,
    },
  };
}

async function refreshTokenPair(service, encodedToken, token, audience) {
  const userId = token[USERS_USERNAME_FIELD];

  const payload = {
    [USERS_USERNAME_FIELD]: userId,
  };

  await checkRules(service, token);

  const { refresh, access } = refreshTokenStrategy(service, token, encodedToken, payload, audience);

  // create rt invalidation rule when token rotation performed
  if (refresh.payload.cs !== token.cs) {
    // eslint-disable-next-line no-use-before-define
    await logout(service, token);
  } else {
    await createRule(service, {
      username: userId,
      rule: {
        params: {
          ttl: token.exp,
          rt: token.cs,
          iat: { lt: access.payload.iat },
        },
      },
    });
  }

  return {
    jwt: access.token,
    jwtRefresh: refresh.token,
    userId,
  };
}

async function logout(service, token) {
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

  if (decodedToken.exp < Date.now()) {
    throw USERS_JWT_EXPIRED;
  }

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
  refresh: refreshTokenPair,
  assertRefreshToken,
  assertAccessToken,
  isStatelessToken,
  isStatelessEnabled,
  assertStatelessEnabled,
};

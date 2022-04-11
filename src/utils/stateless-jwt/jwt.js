// const Promise = require('bluebird');
const pick = require('lodash/pick');
// const jwt = Promise.promisifyAll(require('jsonwebtoken'));

const {
  USERS_USERNAME_FIELD,
  USERS_JWT_ACCESS_REQUIRED,
  USERS_JWT_REFRESH_REQUIRED,
  USERS_JWT_STATELESS_REQUIRED,
  USERS_INVALID_TOKEN,
} = require('../../constants');
const { GLOBAL_RULE_GROUP } = require('./rule-manager');

const REVOKE_RULE_ADD_ACTION = 'revoke-rule.add';
const META_CREDENTIALS = ['alias', 'roles', 'org'];

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

const createAccessPayload = (userId, metadata, extraFields = []) => ({
  [USERS_USERNAME_FIELD]: userId,
  metadata: pick(metadata, [...META_CREDENTIALS, ...extraFields]),
});

const createRefreshPayload = (userId) => ({
  [USERS_USERNAME_FIELD]: userId,
});

const createRule = async (service, ruleSpec) => {
  return service.dispatch(REVOKE_RULE_ADD_ACTION, { params: ruleSpec });
};

/**
 * @param {Microfleet & { JWE: JWE }} service
 */
async function createToken(service, audience, payload) {
  const { config, flake } = service;
  // const { jwt: jwtConfig } = config;
  // const { hashingFunction: algorithm, secret, issuer } = jwtConfig;
  const { issuer } = config;
  const cs = flake.next();

  const finalPayload = {
    ...payload,
    cs,
    iat: Date.now(),
    st: 1,
    iss: issuer,
    aud: audience,
  };

  return {
    // token: jwt.sign(finalPayload, secret, { algorithm, audience, issuer }),
    token: await service.JWE.encode(finalPayload),
    payload: finalPayload,
  };
}

async function createRefreshToken(service, payload, audience) {
  const exp = Date.now() + service.config.jwt.stateless.refreshTTL;
  return createToken(service, audience, {
    ...payload,
    exp,
    irt: 1,
  });
}

async function createAccessToken(service, refreshToken, payload, audience) {
  const exp = Date.now() + service.config.jwt.ttl;

  return createToken(service, audience, {
    ...payload,
    // should not exceed refreshToken exp
    exp: exp > refreshToken.exp ? refreshToken.exp : exp,
    // refresh token id
    rt: refreshToken.cs,
  });
}

async function login(service, userId, audience, metadata) {
  const { stateless } = service.config.jwt;
  const { fields } = stateless;

  const refreshPayload = createRefreshPayload(userId);
  const accessPayload = createAccessPayload(userId, metadata, fields);

  const { token: jwtRefresh, payload: jwtRefreshPayload } = await createRefreshToken(service, refreshPayload, audience);
  const { token: accessToken } = await createAccessToken(
    service,
    jwtRefreshPayload,
    accessPayload,
    audience
  );

  return {
    jwt: accessToken,
    jwtRefresh,
  };
}

async function checkToken(service, token) {
  if (token.exp < Date.now()) {
    throw USERS_INVALID_TOKEN;
  }

  const userId = token[USERS_USERNAME_FIELD];
  const { revocationRulesStorage } = service;
  const now = Date.now();

  const globalRules = await revocationRulesStorage.getFilter(GLOBAL_RULE_GROUP);
  if (!globalRules.match(token)) {
    const localRules = await revocationRulesStorage.getFilter(userId);
    if (!localRules.match(token, now)) {
      return;
    }
  }

  throw USERS_INVALID_TOKEN;
}

async function refreshTokenStrategy({
  service, refreshToken, encodedRefreshToken, accessPayload, refreshPayload, audience,
}) {
  const { refreshRotation: { enabled, always, interval } } = service.config.jwt.stateless;

  if (enabled && (always || (Date.now() > refreshToken.exp - interval))) {
    const refreshTkn = await createRefreshToken(service, refreshPayload, audience);
    const access = await createAccessToken(service, refreshTkn.payload, accessPayload, audience);

    return {
      access,
      refresh: refreshTkn,
    };
  }

  return {
    access: await createAccessToken(service, refreshToken, accessPayload, audience),
    refresh: {
      token: encodedRefreshToken,
      payload: refreshToken,
    },
  };
}

async function refreshTokenPair(service, encodedRefreshToken, refreshToken, audience, metadata) {
  const { stateless } = service.config.jwt;
  const { fields } = stateless;
  const userId = refreshToken[USERS_USERNAME_FIELD];

  const refreshPayload = createRefreshPayload(userId);
  const accessPayload = createAccessPayload(userId, metadata, fields);

  const { refresh, access } = await refreshTokenStrategy({
    service,
    audience,
    refreshToken,
    encodedRefreshToken,
    accessPayload,
    refreshPayload,
  });

  // create rt invalidation rule when token rotation performed
  if (refresh.payload.cs !== refreshToken.cs) {
    // eslint-disable-next-line no-use-before-define
    await logout(service, refreshToken);
  } else {
    await createRule(service, {
      username: userId,
      rule: {
        expireAt: refreshToken.exp,
        rt: refreshToken.cs,
        iat: { lt: access.payload.iat },
      },
    });
  }

  return {
    jwt: access.token,
    jwtRefresh: refresh.token,
  };
}

async function logout(service, token) {
  // -- invalidate current refresh token and all tokens issued by this refresh token
  // set user rule { cs: { in: [verifiedToken.cs, verifiedToken.rt] }
  // -- legacy tokens do not have exp or iat field so ttl of the rule is set to max possible ttl

  await checkToken(service, token);

  const now = Date.now();
  await createRule(service, {
    username: token[USERS_USERNAME_FIELD],
    rule: {
      expireAt: token.exp || now + service.config.jwt.ttl,
      _or: true,
      cs: token.cs,
      rt: token.cs,
    },
  });

  return { success: true };
}

async function verify(service, decodedToken) {
  assertAccessToken(decodedToken);

  await checkToken(service, decodedToken);

  return decodedToken;
}

async function reset(service, userId) {
  // set user rule { userId, iat: Date.now() }
  // last one invalidates all legacy tokens for user
  await createRule(service, {
    username: userId,
    rule: {
      iat: { lte: Date.now() },
    },
  });
}

module.exports = {
  login,
  logout,
  verify,
  reset,
  checkToken,
  refresh: refreshTokenPair,
  assertRefreshToken,
  assertAccessToken,
  isStatelessToken,
  isStatelessEnabled,
  assertStatelessEnabled,
};

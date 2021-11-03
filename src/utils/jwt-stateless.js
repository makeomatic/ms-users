const Promise = require('bluebird');
const jwt = Promise.promisifyAll(require('jsonwebtoken'));

const getMetadata = require('./get-metadata');

const {
  USERS_USERNAME_FIELD,
  USERS_ID_FIELD,
  USERS_INVALID_TOKEN,
  USERS_AUDIENCE_MISMATCH,
} = require('../constants');

const mapJWT = (props) => ({
  jwt: props.jwt,
  jwtRefresh: props.jwtRefresh,
  user: {
    [USERS_ID_FIELD]: props.userId,
    metadata: props.metadata,
  },
});

const getAudience = (audience, defaultAudience) => {
  if (audience !== defaultAudience) {
    return [audience, defaultAudience];
  }

  return [audience];
};

async function createToken(service, audience, payload) {
  const { config, flake } = service;
  const { jwt: jwtConfig } = config;
  const { hashingFunction: algorithm, secret } = jwtConfig;

  const cs = flake.next();

  const finalPayload = {
    ...payload,
    cs,
    iat: Date.now(),
  };

  return {
    token: jwt.sign(finalPayload, secret, { algorithm, audience, issuer: jwtConfig.issuer }),
    cs,
  };
}

async function login(service, userId, _audience) {
  const { config } = service;
  const { jwt: jwtConfig } = config;
  const { defaultAudience } = jwtConfig;
  const audience = getAudience(_audience, defaultAudience);

  const payload = {
    [USERS_USERNAME_FIELD]: userId,
  };

  const { token: jwtRefresh, cs } = createToken(service, audience[0], payload);
  const { token: accessToken } = createToken(service, audience[0], {
    ...payload,
    st: 1,
    rt: cs,
  });

  const props = await Promise.props({
    jwt: accessToken,
    jwtRefresh,
    userId,
    metadata: getMetadata.call(service, userId, audience),
  });

  return mapJWT(props);
}

// expect access token
// eslint-disable-next-line no-unused-vars
async function logout(_service, _decodedToken) {
  // set user rule { cs: { in: [verifiedToken.cs, verifiedToken.rt] }
  return { success: true };
}

async function verify(_service, audience, decodedToken) {
  if (audience.indexOf(decodedToken.aud) === -1) {
    return Promise.reject(USERS_AUDIENCE_MISMATCH);
  }

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
};

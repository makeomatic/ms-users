const { sign, verify } = require('jsonwebtoken');
const getJwksClient = require('jwks-rsa');
const Bluebird = require('bluebird');
const httpRequest = require('request-promise');

// @todo more options from config
const jwksClient = getJwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
});

function transformAccountToResponseFormat(account) {
  return account;
}

async function fixAppleCallbackForBell(request, h) {
  if (request.method === 'post' && request.path.endsWith('/oauth/apple')) {
    const { raw: { req } } = request;

    let payload = '';
    for await (const chunk of req) {
      payload += chunk;
    }

    request.setUrl(`${request.path}?${payload}`);
  }

  return h.continue;
}

function getSecretKey(iss, sub, keyId, privateKey) {
  const claims = {
    iss,
    sub,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 180,
    aud: 'https://appleid.apple.com',
  };

  const token = sign(claims, privateKey, {
    keyid: keyId,
    algorithm: 'ES256',
  });

  return token;
}

function getJwkFromResponse(header, callback) {
  jwksClient.getSigningKey(header.kid, (error, key) => {
    if (error) {
      return callback(error);
    }

    return callback(null, key.publicKey || key.rsaPublicKey);
  });
}

async function getProfile(providerSettings, tokenResponse, query) {
  const {
    access_token: accessToken,
    id_token: idToken,
    refresh_token: refreshToken,
    token_type: tokenType,
    expires_in: expiresIn,
  } = tokenResponse;
  const response = await Bluebird.fromCallback(
    (callback) => verify(idToken, getJwkFromResponse, callback)
  );
  const {
    sub,
    email,
    email_verified: emailVerified,
    is_private_email: isPrivateEmail,
  } = response;
  const credentials = Object.create(null);

  credentials.query = query;
  credentials.email = email;
  credentials.profile = { id: sub, email };
  credentials.internals = {
    email,
    emailVerified,
    isPrivateEmail,
    id: sub,
    accessToken,
    idToken,
    refreshToken,
    tokenType,
    expiresIn,
  };

  return credentials;
}

async function validateGrantCode(providerSettings, code, redirectUrl) {
  const { provider, appId, clientSecret } = providerSettings;
  const response = await httpRequest.post(provider.token, {
    form: {
      code,
      client_id: appId,
      client_secret: clientSecret(appId),
      grant_type: 'authorization_code',
      redirect_uri: redirectUrl,
    },
    json: true,
  });

  return response;
}

function getProvider(options, server) {
  const {
    appId,
    clientId,
    teamId,
    keyId,
    privateKey,
    password,
    isSameSite,
    cookie,
  } = options;

  // adds the "code" parameter to the query string for bell to work correctly
  server.ext('onRequest', fixAppleCallbackForBell);

  return {
    appId,
    password,
    clientId,
    isSameSite,
    cookie,
    clientSecret: (cid) => getSecretKey(teamId, cid || clientId, keyId, privateKey),
    forceHttps: true,
    providerParams: {
      response_mode: 'form_post',
      response_type: 'code', // has no effect, bell forces query.response_type = 'code'
    },
    provider: {
      name: 'apple',
      auth: 'https://appleid.apple.com/auth/authorize',
      token: 'https://appleid.apple.com/auth/token',
      protocol: 'oauth2',
      useParamsAuth: true,
      scope: ['name', 'email'],
      profile: getProfile,
    },
  };
}

module.exports = {
  transformAccountToResponseFormat,
  validateGrantCode,
  options: getProvider,
};

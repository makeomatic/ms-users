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

async function getProfile(providerSettings, tokenResponse) {
  const {
    access_token: accessToken,
    id_token: idToken,
    refresh_token: refreshToken,
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

  tokenResponse.email = email;
  tokenResponse.profile = { id: sub, email };
  tokenResponse.internals = {
    email,
    emailVerified,
    isPrivateEmail,
    id: sub,
    accessToken,
    idToken,
    refreshToken,
  };

  return tokenResponse;
}

async function validateGrantCode(providerSettings, code, redirectUrl) {
  const { provider, clientId, clientSecret } = providerSettings;
  const response = await httpRequest.post(provider.token, {
    form: {
      code,
      client_id: clientId,
      client_secret: clientSecret(),
      grant_type: 'authorization_code',
      redirect_uri: redirectUrl,
    },
    json: true,
  });

  return response;
}

function getProvider(options, server) {
  const {
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
    password,
    clientId,
    isSameSite,
    cookie,
    clientSecret: () => getSecretKey(teamId, clientId, keyId, privateKey),
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

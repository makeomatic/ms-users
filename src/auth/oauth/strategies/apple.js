const { sign, verify } = require('jsonwebtoken');
const getJwksClient = require('jwks-rsa');
const Bluebird = require('bluebird');

// @todo more options from config
const jwksClient = getJwksClient({
  jwksUri: 'https://appleid.apple.com/auth/keys',
});

function transformAccountToResponseFormat(account) {
  return account;
}

function fixAppleCallbackForBell(request, h) {
  if (request.method === 'post' && request.path.endsWith('/oauth/apple')) {
    const { raw: { req } } = request;
    let payload = '';

    return new Promise((resolve, reject) => {
      req.on('error', reject);
      req.on('data', (chunk) => {
        payload += chunk;
      });
      req.on('end', () => {
        request.setUrl(`${request.path}?${payload}`);
        resolve(h.continue);
      });
    });
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

async function getProfile(credentials, params) {
  const response = await Bluebird.fromCallback(
    (callback) => verify(params.id_token, getJwkFromResponse, callback)
  );
  const {
    sub,
    email,
    email_verified: emailVerified,
    is_private_email: isPrivateEmail,
  } = response;

  credentials.profile = { id: sub, email };
  credentials.internals = {
    email,
    emailVerified,
    isPrivateEmail,
    id: sub,
  };

  return credentials;
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
  options: getProvider,
};

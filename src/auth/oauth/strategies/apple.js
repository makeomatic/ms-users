const jose = require('jose');
const getJwksClient = require('jwks-rsa');

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

async function getSecretKey(iss, sub, keyId, privateKey) {
  const claims = {
    iss,
    sub,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 180,
    aud: 'https://appleid.apple.com',
  };

  const signer = new jose.SignJWT(claims);
  const token = await signer
    .setProtectedHeader({
      alg: 'ES256',
      keyId,
    })
    .sign(privateKey);

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
  const response = await jose.jwtVerify(params.id_token, getJwkFromResponse);

  const {
    sub,
    email,
    email_verified: emailVerified,
    is_private_email: isPrivateEmail,
  } = response;

  credentials.email = email;
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
    clientSecret: async () => getSecretKey(teamId, clientId, keyId, privateKey),
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

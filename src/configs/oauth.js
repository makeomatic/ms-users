exports.oauth = {
  enabled: false,
  urlKey: 'jwt',
  cookieKey: 'jwt',
  headerKey: 'authorization',
  debug: {
    $filter: 'env',
    $default: true,
    production: false,
  },
  token: {
    hashingFunction: 'HS256',
    issuer: 'ms-users',
    secret: {
      $filter: 'env',
      $default: 'dajs123jnida071241d-ar-01129hbad7as-akd810',
      production: '',
    },
    extra: {
      expiresIn: '10m', // should be more than enough
    },
  },
  providers: {
    facebook: {
      enabled: false,
      clientId: 'fb-client-id',
      location: 'location',
      clientSecret: 'fb-client-secret',
      cookie: 'mf_bfb',
      isSameSite: 'Lax',
      isSecure: {
        $filter: 'env',
        $default: false,
        production: true,
      },
      forceHttps: {
        $filter: 'env',
        $default: false,
        production: true,
      },
      password: {
        $filter: 'env',
        $default: 'very-long-encryption-password-that-needs-to-be-changed',
        production: '',
      },
    },
    apple: {
      enabled: false,
      // used in /oauth/upgrade action as client ID
      appId: 'com.test.app',
      clientId: 'com.test.service', // service id from apple
      clientSecret: 'just-for-validation', // not used
      teamId: 'TEAM_ID',
      keyId: 'KEY_ID',
      privateKey: 'PRIVATE_KEY',
      password: 'very-long-encryption-password-that-needs-to-be-changed',
      cookie: 'mf_bapp',
      isSameSite: 'Lax',
    },
  },
};

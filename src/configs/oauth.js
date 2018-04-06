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
      expiresIn: '1h',
    },
  },
  providers: {
    facebook: {
      enabled: false,
      clientId: 'fb-client-id',
      location: 'location',
      clientSecret: 'fb-client-secret',
      cookie: 'mf_bfb',
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
  },
};

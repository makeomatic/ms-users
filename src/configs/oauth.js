exports.oauth = {
  enabled: false,
  urlKey: 'jwt',
  cookieKey: 'jwt',
  headerKey: 'authorization',
  token: {
    hashingFunction: 'HS256',
    issuer: 'ms-users',
    secret: {
      $filter: 'env',
      $default: 'dajs123jnida071241d-ar-01129hbad7as-akd810',
      production: '',
    },
  },
  providers: {
    facebook: {
      enabled: false,
      clientId: 'fb-client-id',
      location: 'location',
      clientSecret: 'fb-client-secret',
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

exports.oauth = {
  enabled: false,
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
      forceHttps: true,
      useParamsAuth: false,
      allowRuntimeProviderParams: true,
      password: {
        $filter: 'env',
        $default: 'very-long-encryption-password-that-needs-to-be-changed',
        production: '',
      },
    },
  },
};

/**
 * JWT configuration
 * @type {Object}
 */
exports.jwt = {
  defaultAudience: '*.localhost',
  hashingFunction: 'HS256',
  issuer: 'ms-users',
  secret: 'i-hope-that-you-change-this-long-default-secret-in-your-app',
  ttl: 30 * 24 * 60 * 60 * 1000, // 30 days in ms
  cookies: {
    enabled: false,
    name: 'jwt',
    settings: {
      isHttpOnly: true,
      isSecure: {
        $filter: 'env',
        $default: false,
        production: true,
      },
      path: '/',
      domain: null,
      ttl: 1209600,
      isSameSite: 'Lax',
    },
  },
  stateless: {
    force: false,
    enabled: false,
    refreshTTL: 365 * 24 * 60 * 60 * 1000, // 1 year
    refreshRotation: {
      enabled: false,
      always: false,
      interval: 100 * 24 * 60 * 60 * 1000, // 100 days
    },
    storage: {
      watchOptions: {
        backoffFactor: 100,
        backoffMax: 30000,
      },
    },
    manager: {
      cleanupInterval: 10 * 60 * 1000, // 10 minutes
    },
  },
};

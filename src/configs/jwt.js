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
  lockAfterAttempts: 5,
  globalLockAfterAttempts: 15,
  keepLoginAttempts: 2 * 60 * 60, // 2 hours
  keepGlobalLoginAttempts: 60 * 60 * 24 * 7, // 7 days
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
};

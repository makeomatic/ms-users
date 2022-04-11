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
    jwe: {
      key: {
        symetric: true,
        value: 'a'.repeat(64),
      },
      // https://connect2id.com/products/nimbus-jose-jwt/algorithm-selection-guide#encryption
      // cypher: {
      //   alg: 'RSA-OAEP',
      //   enc: 'A256GCM',
      // },
      cypher: {
        alg: 'dir',
        enc: 'A256CBC-HS512',
      },
    },
    force: false,
    enabled: false,
    trustHeaders: false,
    // additional metadata fields to encode in token
    // hardcoded fields: ['alias', 'roles', 'org']
    fields: [],
    refreshTTL: 365 * 24 * 60 * 60 * 1000, // 1 year
    refreshRotation: {
      enabled: false,
      always: false,
      interval: 100 * 24 * 60 * 60 * 1000, // 100 days
    },
    storage: {
      storageCacheTTL: 60 * 1000, // 1 min
      watchOptions: {
        backoffFactor: 100,
        backoffMax: 30000,
      },
    },
  },
};

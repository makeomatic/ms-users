module.exports = {
  initAdminAccountsDelay: 0,
  validator: {
    ajv: {
      coerceTypes: true,
    },
  },
  validation: {
    templates: {
      invite: 'rfx-invite',
      'organization-user-invite': 'sl-accept-invite',
      'organization-user-register': 'sl-registration-notify',
    },
  },
  server: {
    host: 'localhost',
    port: 80,
    proto: 'http',
  },
  admins: [
    {
      metadata: { firstName: 'User', lastName: '#1' },
      password: '11111111111111111111',
      username: 'user@example.org',
    },
  ],
  logger: {
    defaultLogger: true,
    debug: true,
  },
  plugins: [
    'validator',
    'logger',
    'router',
    'redisSentinel',
    'amqp',
    'http',
    'prometheus',
  ],
  users: {
    audience: 'api',
  },
  oauth: {
    enabled: false,
  },
  jwt: {
    cookies: {
      enabled: true,
    },
  },
};

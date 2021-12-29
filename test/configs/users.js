module.exports = {
  initAdminAccountsDelay: 0,
  oauth: {
    enabled: false,
    token: {
      secret: 'notenablednotenablednotenablednotenablednotenabled',
    },
    providers: {
      facebook: {
        enabled: false,
        password: 'notenablednotenablednotenablednotenablednotenabled',
      },
    },
  },
  validation: {
    templates: {
      invite: 'rfx-invite',
      'organization-user-invite': 'sl-accept-invite',
      'organization-user-register': 'sl-registration-notify',
    },
  },
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
};

module.exports = {
  logger: {
    defaultLogger: true,
    debug: true,
  },
  validation: {
    templates: {
      activate: 'cpst-activate',
      password: 'cpst-password',
      register: 'cpst-register',
      invite: 'rfx-invite',
      organizationUserInvite: 'sl-accept-invite',
      organizationUserAdd: 'sl-registration-notify',
      organizationUserRegister: 'sl-registration-notify',
    },
  },
  registrationLimits: {
    ip: {
      times: 3,
      time: 3600000,
    },
    noDisposable: true,
    checkMX: true,
  },
  phone: {
    account: 'twilio',
    waitChallenge: true,
  },
  oauth: {
    enabled: false,
    providers: {
      facebook: {
        enabled: true,
        clientId: process.env.FACEBOOK_CLIENT_ID || '-------------------',
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET || '------------------',
        location: 'https://ms-users.local',
        password: 'lB4wlZByzpp2R9mGefiLeaZUwVooUuX7G7uctaoeNgxvUs3W',
        apiVersion: 'v8.0',
      },
    },
  },
  jwt: {
    cookies: {
      enabled: true,
    },
  },
  rateLimiters: {
    userLogin: {
      enabled: true,
    },
  },
  cfAccessList: {
    enabled: false,
    auth: {
      token: process.env.CF_TOKEN,
    },
    accessList: {
      accountId: process.env.CF_ACCOUNT_ID,
      prefix: 'test_',
    },
    worker: {
      enabled: false,
    },
  },
  consul: {
    base: {
      host: 'consul',
    },
  },
};

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
    enabled: true,
    providers: {
      facebook: {
        enabled: true,
        clientId: process.env.FACEBOOK_CLIENT_ID,
        clientSecret: process.env.FACEBOOK_CLIENT_SECRET,
        location: 'https://ms-users.local',
        password: 'lB4wlZByzpp2R9mGefiLeaZUwVooUuX7G7uctaoeNgxvUs3W',
        apiVersion: 'v2.9',
      },
    },
  },
  jwt: {
    cookies: {
      enabled: true,
    },
  },
};

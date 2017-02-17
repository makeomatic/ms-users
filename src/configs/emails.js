/**
 * These are the setting for validation/transactional emails
 * @type {Object}
 */
exports.validation = {
  paths: {
    activate: '/activate',
    reset: '/reset',
    invite: '/register',
  },
  subjects: {
    activate: 'Activate your account',
    reset: 'Reset your password',
    password: 'Account Recovery',
    register: 'Account Registration',
    invite: 'Invitation to Register',
  },
  senders: {
    activate: 'noreply <support@example.com>',
    reset: 'noreply <support@example.com>',
    password: 'noreply <support@example.com>',
    register: 'noreply <support@example.com>',
    invite: 'noreply <support@example.com>',
  },
  templates: {
    // specify template names here
  },
  email: 'support@example.com',
};

/**
 * Server configuration to create backlinks for emails
 * @type {Object}
 */
exports.server = {
  proto: 'http',
  host: 'localhost',
  port: 8080,
};

/**
 * Mailer service configuration
 * https://github.com/makeomatic/ms-mailer
 * @type {Object}
 */
exports.mailer = {
  prefix: 'mailer',
  routes: {
    adhoc: 'adhoc',
    predefined: 'predefined',
  },
};

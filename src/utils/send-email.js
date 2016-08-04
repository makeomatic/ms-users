const Errors = require('common-errors');
const Promise = require('bluebird');
const render = require('ms-mailer-templates');
const { updatePassword } = require('../actions/updatePassword.js');
const generatePassword = require('password-generator');
const partial = require('lodash/partial');
const { MAIL_ACTIVATE, MAIL_RESET, MAIL_PASSWORD, MAIL_REGISTER } = require('../constants.js');

// eslint-disable-next-line max-len
const isThrottled = new Errors.HttpStatusError(429, 'We\'ve already sent you an email, if it doesn\'t come - please try again in a little while or send us an email');

/**
 * Generates complete link
 * @param  {Object} server
 * @param  {String} path
 * @return {String} link
 */
function generateLink(server, path) {
  const { proto } = server;
  let { port } = server;

  if ((proto === 'http' && +port === 80) || (proto === 'https' && +port === 443)) {
    port = '';
  } else {
    port = `:${port}`;
  }

  return `${proto}://${server.host + port + path}`;
}
exports.generateLink = generateLink;

/**
 * Send an email with appropriate content
 *
 * @param  {String} email
 * @param  {String} type
 * @return {Promise}
 */
function sendEmail(email, type = MAIL_ACTIVATE, wait = false) {
  const { config, mailer, tokenManager } = this;
  const { validation, server } = config;
  const { ttl, throttle, subjects, senders, paths, secret, email: mailingAccount } = validation;
  const logger = this.log.child({ action: 'sendEmail', email });

  // secret token config
  const tokenConfiguration = {
    action: type,
    id: email,
    secret,
  };

  if (ttl > 0) {
    tokenConfiguration.ttl = ttl;
  }

  if (throttle > 0) {
    tokenConfiguration.throttle = throttle;
  }

  // create token
  return tokenManager
    .create(tokenConfiguration)
    .catchThrow({ message: '429' }, isThrottled)
    .then(token => {
      // generate context
      const context = { token };
      const templateName = validation.templates[type] || type;

      switch (type) {
        case MAIL_ACTIVATE:
        case MAIL_RESET:
          context.qs = `?q=${token.secret}`;
          context.link = generateLink(server, paths[type]);
          break;

        case MAIL_PASSWORD:
        case MAIL_REGISTER:
          context.password = generatePassword(config.pwdReset.length, config.pwdReset.memorable);
          context.login = email;
          break;

        default:
          throw new Errors.InvalidOperationError(`${type} action is not supported`);
      }

      return Promise.props({
        context,
        emailTemplate: render(templateName, context),
      });
    })
    .tap(data => {
      const { context } = data;

      // in case we need to setup a new password
      if (type === MAIL_PASSWORD) {
        return updatePassword.call(this, email, context.password);
      }

      return null;
    })
    .then(function definedSubjectAndSend({ context, emailTemplate }) {
      const mail = {
        subject: subjects[type] || '',
        from: senders[type] || 'noreply <support@example.com>',
        to: email,
        html: emailTemplate,
      };

      const mailSent = mailer
        .send(mailingAccount, mail)
        .return({ sent: true, context })
        .catch(function mailingFailed(err) {
          logger.warn('couldn\'t send email', err);
          return { sent: false, context, err };
        });

      if (wait) {
        return mailSent;
      }

      return {
        queued: true,
        context,
      };
    });
}
exports.send = sendEmail;

// util function to password generator
exports.sendPassword = partial(sendEmail, partial.placeholder, MAIL_REGISTER);

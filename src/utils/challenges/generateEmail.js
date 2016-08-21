const Promise = require('bluebird');
const render = require('ms-mailer-templates');
const generateLink = require('../generateBacklink.js');
const generatePassword = require('password-generator');
const partial = require('lodash/partial');
const identity = require('lodash/identity');
const sendEmail = require('./sendEmail.js');
const { InvalidOperationError } = require('common-errors');
const { updatePassword } = require('../../actions/updatePassword.js');
const { MAIL_ACTIVATE, MAIL_RESET, MAIL_PASSWORD, MAIL_REGISTER, MAIL_INVITE } = require('../../constants.js');

function generateEmail(email, type, ctx = {}, opts = {}, nodemailer = {}) {
  const { config } = this;
  const { validation, server, pwdReset } = config;
  const { paths } = validation;

  // in the case of emails namespace is email where we send data to
  const { wait = false, send = false } = opts;
  const context = { ...ctx };
  const actions = {};
  const templateName = validation.templates[type] || type;

  switch (type) {
    case MAIL_ACTIVATE:
    case MAIL_RESET:
    case MAIL_INVITE:
      // generate secret
      context.qs = `?q=${context.token.secret}`;
      context.link = generateLink(server, paths[type]);
      break;

    case MAIL_PASSWORD:
    case MAIL_REGISTER:
      context.password = generatePassword(pwdReset.length, pwdReset.memorable);
      context.login = email;
      break;

    default:
      throw new InvalidOperationError(`${type} action is not supported`);
  }

  // in case we need to setup a new password
  if (type === MAIL_PASSWORD) {
    actions.updatePassword = updatePassword.call(this, email, context.password);
  }

  return Promise
    .props({
      ...actions,
      type,
      email,
      context,
      nodemailer,
      emailTemplate: render(templateName, context),
    })
    .bind(this)
    .then(output => (send ? [output, wait] : [output]))
    .spread(send ? sendEmail : identity);
}

// main export
module.exports = exports = generateEmail;

// short-hand methods
exports.newPassword = partial(generateEmail, partial.placeholder, MAIL_PASSWORD, {}, { send: true });
exports.register = partial(generateEmail, partial.placeholder, MAIL_REGISTER, {}, partial.placeholder);

// these should simply generate an email
// as they are likely to be used from withing createChallenge or require custom context
exports.activation = partial(generateEmail, partial.placeholder, MAIL_ACTIVATE);
exports.resetPassword = partial(generateEmail, partial.placeholder, MAIL_RESET);
exports.invite = partial(generateEmail, partial.placeholder, MAIL_INVITE);

const Promise = require('bluebird');
const render = require('ms-mailer-templates');
const generatePassword = require('password-generator');
const { stringify } = require('qs');
const partial = require('lodash/partial');
const identity = require('lodash/identity');
const { InvalidOperationError } = require('common-errors');
const sendEmail = require('./send');
const generateLink = require('../../generate-backlink');
const { updatePassword } = require('../../../actions/updatePassword');
const {
  USERS_ACTION_ACTIVATE,
  USERS_ACTION_RESET,
  USERS_ACTION_PASSWORD,
  USERS_ACTION_REGISTER,
  USERS_ACTION_INVITE,
  USERS_ACTION_ORGANIZATION_INVITE,
  USERS_ACTION_ORGANIZATION_REGISTER,
} = require('../../../constants.js');

// will be replaced later
const { placeholder } = partial;

function generate(email, type, ctx = {}, opts = {}, nodemailer = {}) {
  const { config } = this;
  const { validation, server, pwdReset } = config;
  const { paths } = validation;

  // in the case of emails namespace is email where we send data to
  const { wait = false, send = false } = opts;
  const context = { ...ctx };
  const actions = {};
  const templateName = validation.templates[type] || type;

  switch (type) {
    case USERS_ACTION_ACTIVATE:
    case USERS_ACTION_RESET:
    case USERS_ACTION_INVITE:
      // generate secret
      context.qs = `?q=${context.token.secret}`;
      context.link = generateLink(server, paths[type]);
      break;
    case USERS_ACTION_ORGANIZATION_INVITE:
      // generate secret
      context.qs = `?${stringify({
        q: context.token.secret,
        organizationId: ctx.organizationId,
        username: ctx.email,
      })}`;
      context.link = generateLink(server, paths[type]);
      break;
    case USERS_ACTION_ORGANIZATION_REGISTER:
      // generate secret
      context.qs = `?${stringify({
        password: ctx.password,
        login: ctx.email,
      })}`;
      context.link = generateLink(server, paths[type]);
      break;

    case USERS_ACTION_PASSWORD:
    case USERS_ACTION_REGISTER:
      context.password = generatePassword(pwdReset.length, pwdReset.memorable);
      context.login = email;
      break;

    default:
      throw new InvalidOperationError(`${type} action is not supported`);
  }

  // in case we need to setup a new password
  if (type === USERS_ACTION_PASSWORD) {
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
    .then((output) => (send ? [output, wait] : [output]))
    .spread(send ? sendEmail : identity);
}

// main export
module.exports = exports = generate;

// short-hand methods
exports.newPassword = partial(generate, placeholder, USERS_ACTION_PASSWORD, {}, { send: true });
exports.register = partial(generate, placeholder, USERS_ACTION_REGISTER, placeholder, placeholder);

// these should simply generate an email
// as they are likely to be used from withing createChallenge or require custom context
exports.activation = partial(generate, placeholder, USERS_ACTION_ACTIVATE);
exports.resetPassword = partial(generate, placeholder, USERS_ACTION_RESET);
exports.invite = partial(generate, placeholder, USERS_ACTION_INVITE);

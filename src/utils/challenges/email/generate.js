const Promise = require('bluebird');
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
  USERS_ACTION_ORGANIZATION_ADD,
  USERS_ACTION_VERIFY_CONTACT,
} = require('../../../constants');

// will be replaced later
const { placeholder } = partial;

function generate(email, type, ctx = {}, opts = {}, nodemailer = {}) {
  const { config } = this;
  const { validation, server, pwdReset } = config;
  const { paths, hosts = {} } = validation;

  // in the case of emails namespace is email where we send data to
  const { wait = false, send = false } = opts;
  const context = { ...ctx };
  const actions = {};
  const templateName = validation.templates[type] || type;
  const { host } = server;
  const serverConfig = { ...server, host: hosts[type] || host };

  context.lng = context.i18nLocale;

  switch (type) {
    case USERS_ACTION_ACTIVATE:
    case USERS_ACTION_RESET:
    case USERS_ACTION_INVITE:
    case USERS_ACTION_VERIFY_CONTACT:
      // generate secret
      context.qs = `?${stringify({
        q: context.token.secret,
        lng: context.lng,
      })}`;
      context.link = generateLink(serverConfig, paths[type]);
      break;
    case USERS_ACTION_ORGANIZATION_ADD:
      context.qs = `?${stringify({
        login: ctx.email,
        firstName: ctx.firstName,
        lastName: ctx.lastName,
        organizationId: ctx.organizationId,
        lng: context.lng,
      })}`;
      context.link = generateLink(serverConfig, paths[USERS_ACTION_ORGANIZATION_ADD]);
      break;
    case USERS_ACTION_ORGANIZATION_REGISTER:
      context.qs = `?${stringify({
        password: ctx.password,
        login: ctx.email,
        firstName: ctx.firstName,
        lastName: ctx.lastName,
        organizationId: ctx.organizationId,
        lng: context.lng,
      })}`;
      context.link = generateLink(serverConfig, paths[USERS_ACTION_ORGANIZATION_REGISTER]);
      break;
    case USERS_ACTION_ORGANIZATION_INVITE:
      context.qs = `?${stringify({
        q: context.token.secret,
        organizationId: ctx.organizationId,
        username: ctx.email,
        firstName: ctx.firstName,
        lastName: ctx.lastName,
        skipPassword: ctx.skipPassword,
        lng: context.lng,
      })}`;
      context.link = generateLink(serverConfig, paths[USERS_ACTION_ORGANIZATION_INVITE]);
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
    actions.updatePassword = updatePassword(this, email, context.password);
  }

  this.log.info('Generated mail %s', templateName);

  return Promise
    .props({
      ...actions,
      type,
      email,
      context,
      nodemailer,
      templateName,
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

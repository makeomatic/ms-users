const Promise = require('bluebird');
const render = require('ms-mailer-templates');
const generateLink = require('./generateBacklink.js');
const throttle = require('../tokens/throttle.js');
const { InvalidOperationError } = require('common-errors');
const { updatePassword } = require('../../actions/updatePassword.js');
const { safeEncode } = require('../tokens/crypto.js');
const { MAIL_ACTIVATE, MAIL_RESET, MAIL_PASSWORD, MAIL_REGISTER, MAIL_INVITE } = require('../../constants.js');

module.exports = function generate(data, type, ctx = {}) {
  const { config } = this;
  const { validation, server } = config;
  // eslint-disable-next-line max-len
  const { paths, secret: sharedSecret, algorithm } = validation;

  // in the case of emails namespace is email where we send data to
  const { id: email, secret, namespace } = data;
  const context = { ...ctx };
  const actions = {};
  const templateName = validation.templates[type] || type;

  switch (type) {
    case MAIL_ACTIVATE:
    case MAIL_RESET:
    case MAIL_INVITE: {
      // generate secret
      const token = safeEncode(algorithm, sharedSecret, email, secret);
      context.qs = `?q=${token}`;
      context.link = generateLink(server, paths[type]);
      break;
    }

    case MAIL_PASSWORD:
    case MAIL_REGISTER:
      context.login = email;
      break;

    default:
      throw new InvalidOperationError(`${type} action is not supported`);
  }

  // in case we need to setup a new password
  if (type === MAIL_PASSWORD) {
    actions.updatePassword = updatePassword.call(this, email, context.password);
  } else {
    actions.throttle = throttle.call(this, namespace, secret);
  }

  return Promise.props({
    ...actions,
    type,
    email,
    context,
    emailTemplate: render(templateName, context),
  });
};

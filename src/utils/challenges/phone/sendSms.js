const Errors = require('common-errors');
const generatePassword = require('password-generator');
const is = require('is');
const Promise = require('bluebird');
const {
  USERS_ACTION_ACTIVATE,
  USERS_ACTION_REGISTER,
  USERS_ACTION_RESET,
} = require('../../../constants');

function sendSms(tel, action, context = {}, wait = false) {
  const { account, prefix, messages } = this.config.phone;
  const template = messages[action];
  let message;

  if (is.undefined(template) === true) {
    throw new Errors.NotImplementedError(`Template for action ${action}`);
  }

  switch (action) {
    case USERS_ACTION_ACTIVATE:
    case USERS_ACTION_RESET:
      message = template.replace('%s', context.token.secret);
      break;
    case USERS_ACTION_REGISTER:
      message = template.replace('%s', context.password);
      break;
    default:
      throw new Errors.NotImplementedError(`Message for action ${action}`);
  }

  const sendSmsPromise = this.amqp.publishAndWait(`${prefix}.message.predefined`, {
    account,
    message,
    to: tel,
  });

  if (wait) {
    return sendSmsPromise.return({ context });
  }

  return {
    queued: true,
    context,
  };
}

sendSms.register = function register(tel, wait) {
  const { pwdReset } = this.config;
  const password = generatePassword(pwdReset.length, pwdReset.memorable);

  return Promise.bind(this, [tel, USERS_ACTION_REGISTER, { password }, wait])
    .spread(sendSms);
};

module.exports = sendSms;

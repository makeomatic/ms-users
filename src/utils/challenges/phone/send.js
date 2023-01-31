const Errors = require('common-errors');
const generatePassword = require('password-generator');
const is = require('is');
const {
  USERS_ACTION_ACTIVATE,
  USERS_ACTION_DISPOSABLE_PASSWORD,
  USERS_ACTION_REGISTER,
  USERS_ACTION_RESET,
  USERS_ACTION_VERIFY_CONTACT,
} = require('../../../constants');

async function send(tel, action, context = {}) {
  const {
    account, route, publishOptions, messages, waitChallenge,
  } = this.config.phone;
  const template = messages[action];
  let message;

  if (is.undefined(template) === true) {
    throw new Errors.NotImplementedError(`Template for action ${action}`);
  }

  switch (action) {
    case USERS_ACTION_ACTIVATE:
    case USERS_ACTION_DISPOSABLE_PASSWORD:
    case USERS_ACTION_RESET:
    case USERS_ACTION_VERIFY_CONTACT:
      message = template.replace('%s', context.token.secret);
      break;
    case USERS_ACTION_REGISTER:
      message = template.replace('%s', context.password);
      break;
    default:
      throw new Errors.NotImplementedError(`Message for action ${action}`);
  }

  // `${prefix}.message.predefined`
  const sendingPromise = this.amqp.publishAndWait(route, {
    account,
    message,
    to: `+${tel}`,
  }, publishOptions);

  if (waitChallenge) {
    try {
      await sendingPromise;
    } catch (err) {
      this.log.warn({ err }, 'failed to send challenge message');
    }

    return { context };
  }

  // to avoid unhandled errors
  sendingPromise.catch((err) => {
    this.log.warn({ err }, 'failed to send challenge message');
  });

  return {
    queued: true,
    context,
  };
}

send.register = async function register(tel, wait) {
  const { pwdReset } = this.config;
  const password = generatePassword(pwdReset.length, pwdReset.memorable);

  return send.call(this, tel, USERS_ACTION_REGISTER, { password }, wait);
};

module.exports = send;

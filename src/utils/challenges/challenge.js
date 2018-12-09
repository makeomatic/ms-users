const partial = require('lodash/partial');
const { HttpStatusError } = require('common-errors');
const generateEmail = require('./email/generate.js');
const {
  CHALLENGE_TYPE_EMAIL,
  CHALLENGE_TYPE_PHONE,
} = require('../../constants.js');
const sendSms = require('./phone/send');

// eslint-disable-next-line max-len
const isThrottled = new HttpStatusError(429, 'We\'ve already sent you an email, if it doesn\'t come - please try again in a little while or send us an email');

// contains challenges
const CHALLENGES = {

  [CHALLENGE_TYPE_EMAIL]: (action, ctx, wait = false) => partial(generateEmail, partial.placeholder, action, ctx, { wait, send: true }),

  [CHALLENGE_TYPE_PHONE]: (action, ctx) => partial(sendSms, partial.placeholder, action, ctx),
};

// select challenge helper
const selectChallenge = (type, action, ctx, wait) => CHALLENGES[type](action, ctx, wait);

/**
 * Send an email with appropriate content
 *
 * @param {String=CHALLENGE_TYPE_EMAIL,CHALLENGE_TYPE_PHONE} type
 * @param {Object} opts - `ms-token` options
 * @param {Object} ctx - additional context
 * @param {Boolean} [wait=false] - should we wait for challenge confirmation?
 * @return {Promise}
 */
async function generateChallenge(type, opts, ctx = {}, wait = false) {
  try {
    const token = await this.tokenManager.create(opts);
    ctx.token = token;
  } catch (error) {
    if (error.message === '429') {
      throw isThrottled;
    }

    throw error;
  }

  const handler = selectChallenge(type, opts.action, ctx, wait);

  return handler.call(this, opts.id);

  // return this
  //   .tokenManager
  //   .create(opts)
  //   .catchThrow({ message: '429' }, isThrottled)
  //   .then((token) => {
  //     ctx.token = token;
  //
  //     return opts.id;
  //   })
  //   .bind(this)
  //   .then(selectChallenge(type, opts.action, ctx, wait));
}

generateChallenge.selectChallenge = selectChallenge;

module.exports = generateChallenge;

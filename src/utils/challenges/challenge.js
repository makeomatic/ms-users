const partial = require('lodash/partial');
const moment = require('moment');
const { HttpStatusError } = require('common-errors');
const generateEmail = require('./email/generate.js');
const {
  CHALLENGE_TYPE_EMAIL,
  CHALLENGE_TYPE_PHONE,
} = require('../../constants.js');
const sendSms = require('./phone/send');

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
      const duration = moment().add(opts.ttl, 'seconds').toNow(true);
      const msg = `We've already sent you an email, if it doesn't come - please try again in ${duration} or send us an email`;
      throw new HttpStatusError(429, msg);
    }

    throw error;
  }

  const handler = selectChallenge(type, opts.action, ctx, wait);

  return handler.call(this, opts.id);
}

generateChallenge.selectChallenge = selectChallenge;

module.exports = generateChallenge;

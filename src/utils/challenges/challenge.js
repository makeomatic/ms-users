const partial = require('lodash/partial');
const generateEmail = require('./generateEmail.js');
const { HttpStatusError } = require('common-errors');
const {
  CHALLENGE_TYPE_EMAIL,
  CHALLENGE_TYPE_PHONE,
} = require('../../constants.js');

// eslint-disable-next-line max-len
const isThrottled = new HttpStatusError(429, 'We\'ve already sent you an email, if it doesn\'t come - please try again in a little while or send us an email');

// contains challenges
const CHALLENGES = {

  [CHALLENGE_TYPE_EMAIL]: (action, ctx, wait = false) =>
    partial(generateEmail, partial.placeholder, action, ctx, { wait, send: true }),

  // eslint-disable-next-line no-unused-vars
  [CHALLENGE_TYPE_PHONE]: (action, ctx, wait) => function send(data) {
    throw new Error('not implemented yet');
  },
};

// select challenge helper
const selectChallenge = (type, template, ctx) => CHALLENGES[type](template, ctx);

/**
 * Send an email with appropriate content
 *
 * @param {String=CHALLENGE_TYPE_EMAIL,CHALLENGE_TYPE_PHONE} type
 * @param {Object} opts - `ms-token` options
 * @param {Object} ctx - additional context
 * @param {Boolean} [wait=false] - should we wait for challenge confirmation?
 * @return {Promise}
 */
function generateChallenge(type, opts, ctx = {}, wait = false) {
  return this
    .tokenManager
    .create(opts)
    .catchThrow({ message: '429' }, isThrottled)
    .then(token => {
      ctx.token = token;
      return opts.id;
    })
    .bind(this)
    .then(selectChallenge(type, opts.action, ctx, wait));
}

// basic method
module.exports = exports = generateChallenge;

const Promise = require('bluebird');
const { CHALLENGE_TYPE_EMAIL, CHALLENGE_TYPE_PHONE } = require('../constants.js');

// email challenges
const createToken = require('./tokens/create.js');
const generateEmail = require('./emails/generate.js');
const sendEmail = require('./emails/send.js');

// contains challenges
const CHALLENGES = {

  [CHALLENGE_TYPE_EMAIL]: (template, ctx) => function send(data) {
    return generateEmail
      .call(this, data, template, ctx)
      .then(sendEmail);
  },

  // eslint-disable-next-line no-unused-vars
  [CHALLENGE_TYPE_PHONE]: (template, ctx) => function send(data) {
    throw new Error('not implemented yet');
  },
};

// select challenge helper
const selectChallenge = (type, template, ctx) => CHALLENGES[type](template, ctx);

/**
 * Send an email with appropriate content
 *
 * @param  {String} email
 * @param  {String} type
 * @return {Promise}
 */
module.exports = function generateChallenge({ id, type, template, secret, ctx, wait }) {
  const challengeType = `${type}/${template}`;
  return Promise
    .bind(this, [id, challengeType, secret])
    .spread(createToken)
    .then(selectChallenge(type, template, ctx))
    .then(promise => (wait ? promise : null));
};

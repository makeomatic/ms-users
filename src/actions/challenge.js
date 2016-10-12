const Promise = require('bluebird');
const Errors = require('common-errors');
const getInternalData = require('../utils/getInternalData.js');
const getMetadata = require('../utils/getMetadata.js');
const isActive = require('../utils/isActive.js');
const challenge = require('../utils/challenges/challenge.js');
const { USERS_ACTION_ACTIVATE, CHALLENGE_TYPE_EMAIL } = require('../constants.js');

/**
 * @api {amqp} <prefix>.challenge Creates user challenges
 * @apiVersion 1.0.0
 * @apiName ChallengeUser
 * @apiGroup Users
 *
 * @apiDescription Must be used internally to create user challenges. Currently only email challenge is supported. Contains
 * password reset challenge & account activation challenge. The latter is called from the `registration` action automatically,
 * when the account must complete the challenge
 *
 * @apiParam (Payload) {String="email"} type - type of challenge, only "email" is supported now
 * @apiParam (Payload) {String} username - user's username
 * @apiParam (Payload) {String} [remoteip] - used for security log
 * @apiParam (Payload) {String} [metadata] - not used, but in the future this would be associated with user when challenge is required
 *
 */
function sendChallenge(request) {
  const { username, type } = request.params;
  const { throttle, ttl } = this.config.token[CHALLENGE_TYPE_EMAIL];
  const { defaultAudience } = this.config.jwt;

  // TODO: record all attemps
  // TODO: add metadata processing on successful email challenge

  return Promise
    .bind(this, username)
    .then(getInternalData)
    .tap(isActive)
    .throw(new Errors.HttpStatusError(417, `${username} is already active`))
    .catchReturn({ statusCode: 412 }, [username, defaultAudience])
    .spread(getMetadata)
    .then(meta => [
      type,
      {
        id: username,
        action: USERS_ACTION_ACTIVATE,
        ttl,
        throttle,
      },
      meta[defaultAudience],
    ])
    .spread(challenge);
}

module.exports = sendChallenge;

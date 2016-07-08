const Promise = require('bluebird');
const emailChallenge = require('../utils/send-email.js');
const isActive = require('../utils/isActive');
const { User } = require('../model/usermodel');
const { ModelError, ERR_ACCOUNT_NOT_ACTIVATED, ERR_USERNAME_ALREADY_ACTIVE } = require('../model/modelError');

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
module.exports = function sendChallenge(message) {
  const { username } = message;

  // TODO: record all attemps
  // TODO: add metadata processing on successful email challenge

  return Promise
    .bind(this, username)
    .then(User.getOne)
    .tap(isActive)
    .throw(new ModelError(ERR_USERNAME_ALREADY_ACTIVE, username))
    .catchReturn({ code: ERR_ACCOUNT_NOT_ACTIVATED }, username)
    .then(emailChallenge.send);
};

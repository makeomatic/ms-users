const { ActionTransport } = require('mservice');
const Promise = require('bluebird');
const Errors = require('common-errors');
const emailChallenge = require('../utils/send-email.js');
const getInternalData = require('../utils/getInternalData.js');
const isActive = require('../utils/isActive.js');

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
  const { username } = request.params;

  // TODO: record all attemps
  // TODO: add metadata processing on successful email challenge

  return Promise
    .bind(this, username)
    .then(getInternalData)
    .tap(isActive)
    .throw(new Errors.HttpStatusError(417, `${username} is already active`))
    .catchReturn({ statusCode: 412 }, username)
    .then(emailChallenge.send);
}

sendChallenge.schema = 'challenge';

sendChallenge.transports = [ActionTransport.amqp];

module.exports = sendChallenge;

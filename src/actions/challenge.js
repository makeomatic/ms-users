const { ActionTransport } = require('@microfleet/plugin-router');

const { getInternalData } = require('../utils/user-data');
const getMetadata = require('../utils/get-metadata');
const isActive = require('../utils/is-active');
const challenge = require('../utils/challenges/challenge');
const {
  USERS_ACTION_ACTIVATE,
  USER_ALREADY_ACTIVE,
  USERS_USERNAME_FIELD,
  USERS_ID_FIELD,
} = require('../constants');

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
module.exports = async function sendChallenge({ params }) {
  // TODO: record all attempts
  // TODO: add metadata processing on successful email challenge

  const service = this;
  const { config } = service;
  const { defaultAudience } = config.jwt;
  const { throttle, ttl } = config.token[params.type];
  const { username, type } = params;

  const internalData = await getInternalData.call(service, username);

  if (isActive(internalData, true)) throw USER_ALREADY_ACTIVE;

  const userId = internalData[USERS_ID_FIELD];
  const resolvedUsername = internalData[USERS_USERNAME_FIELD];

  const { [defaultAudience]: metadata } = await getMetadata(service, userId, defaultAudience);

  const challengeOpts = {
    ttl,
    throttle,
    action: USERS_ACTION_ACTIVATE,
    id: resolvedUsername,
  };

  return challenge.call(service, type, challengeOpts, metadata);
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

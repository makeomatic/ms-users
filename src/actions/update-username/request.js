const { ActionTransport } = require('@microfleet/plugin-router');

const { requestUsernameUpdate } = require('../../utils/update-username');
const { resolveUserId } = require('../../utils/userData');
const { checkMFA } = require('../../utils/mfa');
const isActive = require('../../utils/is-active');
const isBanned = require('../../utils/is-banned');
const {
  ErrorConflictUserExists,
  ErrorUserNotFound,
  MFA_TYPE_OPTIONAL,
  USERS_ID_FIELD,
} = require('../../constants');

/**
 * @api {amqp} <prefix>.update-username.request Request update username
 * @apiVersion 1.0.0
 * @apiName RequestUpdateUsername
 * @apiGroup Users
 *
 * @apiDescription Sends the user a secret code that will be used
 * to confirm the user name update. Currently only phone is supported.
 *
 * @apiSchema (Payload) {jsonschema=../../../schemas/update-username/request.json} apiParam
 *
 * @apiSuccess (Response) {Object} uid Token UID
 */
module.exports = async function requestUpdateUsernameAction(request) {
  const { challengeType, i18nLocale, value } = request.params;
  const { internalData } = request.locals;

  if (!internalData) {
    throw ErrorUserNotFound;
  }

  await isActive(internalData);
  isBanned(internalData);

  if (await resolveUserId.call(this, value)) {
    throw ErrorConflictUserExists;
  }

  return requestUsernameUpdate(
    this,
    internalData[USERS_ID_FIELD],
    value,
    challengeType,
    { i18nLocale }
  );
};

module.exports.mfa = MFA_TYPE_OPTIONAL;
module.exports.allowed = checkMFA;
module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

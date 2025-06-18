const { ActionTransport } = require('@microfleet/plugin-router');

const { requestUsernameUpdate } = require('../../utils/update-username');
const { getInternalData, resolveUserId } = require('../../utils/userData');
const isActive = require('../../utils/is-active');
const isBanned = require('../../utils/is-banned');
const {
  ErrorConflictUserExists,
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
  const { challengeType, i18nLocale, username, value } = request.params;
  const internalData = await getInternalData.call(this, username);

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

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

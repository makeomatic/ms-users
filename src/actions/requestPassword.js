const Promise = require('bluebird');
const { getInternalData } = require('../utils/userData');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const hasPassword = require('../utils/hasPassword.js');
const getMetadata = require('../utils/getMetadata.js');
const challenge = require('../utils/challenges/challenge.js');
const {
  USERS_ACTION_PASSWORD,
  USERS_ACTION_RESET,
  USERS_USERNAME_FIELD,
} = require('../constants.js');

/**
 * @api {amqp} <prefix>.requestPassword Reset Password
 * @apiVersion 1.0.0
 * @apiName PasswordReset
 * @apiGroup Users
 *
 * @apiDescription Allows one either to request new password instantly, or generate a challenge.
 * In the first case would send new password to email instantly and will change it in the system.
 * Use-case is discouraged, because it can be used to DOS account (throttling not implemented).
 * Second case sends reset token to email and it can be used in `updatePassword` endpoint
 * alongside new password to generate it
 *
 * @apiSchema {jsonschema=../../schemas/requestPassword.json} apiParam
 */
function requestPassword(request) {
  const { challengeType, username: usernameOrAlias, generateNewPassword } = request.params;
  const { [challengeType]: tokenOptions } = this.config.token;
  const { defaultAudience } = this.config.jwt;
  const action = generateNewPassword ? USERS_ACTION_PASSWORD : USERS_ACTION_RESET;

  // TODO: make use of remoteip in security logs?
  // var remoteip = request.params.remoteip;

  return Promise
    .bind(this, usernameOrAlias)
    .then(getInternalData)
    .tap(isActive)
    .tap(isBanned)
    .tap(hasPassword)
    .then(data => [data[USERS_USERNAME_FIELD], defaultAudience])
    .spread(getMetadata)
    .get(defaultAudience)
    .then(meta => [
      challengeType,
      {
        id: meta[USERS_USERNAME_FIELD],
        action,
        ...tokenOptions,
      },
      meta,
    ])
    .spread(challenge)
    .return({ success: true });
}

module.exports = requestPassword;

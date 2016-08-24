const Promise = require('bluebird');
const getInternalData = require('../utils/getInternalData.js');
const isActive = require('../utils/isActive.js');
const isBanned = require('../utils/isBanned.js');
const { USERS_ACTION_PASSWORD, USERS_ACTION_RESET } = require('../constants.js');
const challenge = require('../utils/challenges/challenge.js');

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
  const action = generateNewPassword ? USERS_ACTION_PASSWORD : USERS_ACTION_RESET;

  // TODO: make use of remoteip in security logs?
  // var remoteip = request.params.remoteip;

  return Promise
    .bind(this, usernameOrAlias)
    .then(getInternalData)
    .tap(isActive)
    .tap(isBanned)
    .then(data => ([challengeType, {
      id: data.username,
      action,
      ...tokenOptions,
    }]))
    .spread(challenge)
    .return({ success: true });
}

module.exports = requestPassword;

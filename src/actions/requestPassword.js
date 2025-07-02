const Promise = require('bluebird');
const { ActionTransport } = require('@microfleet/plugin-router');

const { getInternalData } = require('../utils/userData');
const isActive = require('../utils/is-active');
const isBanned = require('../utils/is-banned');
const hasPassword = require('../utils/has-password');
const getMetadata = require('../utils/get-metadata');
const challenge = require('../utils/challenges/challenge');
const {
  USERS_ACTION_PASSWORD,
  USERS_ACTION_RESET,
  USERS_ID_FIELD,
  USERS_USERNAME_FIELD,
} = require('../constants');

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
async function requestPassword(request) {
  const { challengeType, username: usernameOrAlias, generateNewPassword } = request.params;
  const { [challengeType]: tokenOptions } = this.config.token;
  const { defaultAudience } = this.config.jwt;
  const action = generateNewPassword ? USERS_ACTION_PASSWORD : USERS_ACTION_RESET;

  // TODO: make use of remoteip in security logs?
  // var remoteip = request.params.remoteip;

  const internalData = await getInternalData.call(this, usernameOrAlias);

  await Promise.all([
    isActive(internalData),
    isBanned(internalData),
    hasPassword(internalData),
  ]);

  const metadata = await getMetadata(this, internalData[USERS_ID_FIELD], defaultAudience);
  const meta = metadata[defaultAudience];

  const opts = {
    id: meta[USERS_USERNAME_FIELD],
    action,
    ...tokenOptions,
  };
  await challenge.call(this, challengeType, opts, meta);

  return { success: true };
}

requestPassword.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = requestPassword;

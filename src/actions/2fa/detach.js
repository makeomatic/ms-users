const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const hasTotp = require('../../utils/hasTotp.js');
const { verifyTotp } = require('../../utils/2fa.js');
const { USERS_2FA_SECRET, USERS_2FA_RECOVERY } = require('../../constants');

function getSecret(userId) {
  return this.redis.get(redisKey(USERS_2FA_SECRET, userId));
}

function removeData(userId) {
  // remove keys
  return this.redis
    .pipeline()
    .del(redisKey(USERS_2FA_SECRET, userId))
    .del(redisKey(USERS_2FA_RECOVERY, userId))
    .exec()
    .then(handlePipeline)
    .return({ enabled: false });
}

/**
 * @api {amqp} <prefix>.detach Detach
 * @apiVersion 1.0.0
 * @apiName Detach
 * @apiGroup Users
 *
 * @apiDescription Allows to detach secret key and recovery code from user's account,
 * basically disables 2FA.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 * @apiHeader (Authorization) {String} X-Auth-TOTP TOTP or recoveryCode
 * @apiHeaderExample X-Auth-TOTP-Example:
 *     "X-Auth-TOTP: 123456"
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} totp - 6 chars time-based one time password or
 * 8 characters hex recovery code
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function detach({ params }) {
  const { username, totp } = params;
  const { redis } = this;

  return Promise
    .bind({ redis }, username)
    .then(getSecret)
    .then(secret => verifyTotp(secret, totp, username))
    .then(() => removeData(username));
};

module.exports.allowed = hasTotp;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

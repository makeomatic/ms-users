const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const redisKey = require('../../utils/key');
const { checkTotp } = require('../../utils/2fa.js');
const { USERS_2FA_SECRET, USERS_2FA_RECOVERY } = require('../../constants');

function removeData() {
  const { username, redis } = this;

  return redis
    .del(redisKey(USERS_2FA_SECRET, username), redisKey(USERS_2FA_RECOVERY, username))
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
  const { username } = params;
  const { redis } = this;
  const ctx = { redis, username };

  return Promise
    .bind(ctx)
    .then(removeData);
};

module.exports.tfa = true;
module.exports.allowed = checkTotp;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

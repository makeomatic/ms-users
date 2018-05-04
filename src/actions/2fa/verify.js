const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const redisKey = require('../../utils/key');
const hasTotp = require('../../utils/hasTotp.js');
const { verifyTotp } = require('../../utils/2fa.js');
const { USERS_2FA_SECRET } = require('../../constants');

function getSecret() {
  return this.redis.get(redisKey(USERS_2FA_SECRET, this.username));
}

/**
 * @api {amqp} <prefix>.verify Verify TOTP
 * @apiVersion 1.0.0
 * @apiName Verify
 * @apiGroup Users
 *
 * @apiDescription Allows to verify if TOTP provided by the user is valid.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} totp - 6 chars time-based one time password or
 * 8 characters hex recovery code
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function verify({ params }) {
  const { username, totp } = params;
  const { redis } = this;
  const ctx = { redis, username, totp };

  return Promise
    .bind(ctx)
    .then(getSecret)
    .then(verifyTotp);
};

module.exports.allowed = hasTotp;
module.exports.transports = [ActionTransport.amqp];

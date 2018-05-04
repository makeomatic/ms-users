const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const hasTotp = require('../../utils/hasTotp.js');
const { verifyTotp, generateRecoveryCodes } = require('../../utils/2fa.js');
const { USERS_2FA_SECRET, USERS_2FA_RECOVERY } = require('../../constants');

function getSecret() {
  return this.redis.get(redisKey(USERS_2FA_SECRET, this.username));
}

function storeData(recoveryCodes) {
  const redisKeyRecovery = redisKey(USERS_2FA_RECOVERY, this.username);

  return this.redis
    .pipeline()
    .del(redisKeyRecovery)
    .sadd(redisKeyRecovery, recoveryCodes)
    .exec()
    .then(handlePipeline)
    .return({ recoveryCodes, regenerated: true });
}

/**
 * @api {amqp} <prefix>.regenerate-codes Regenerate recovery codes
 * @apiVersion 1.0.0
 * @apiName RegenerateCodes
 * @apiGroup Users
 *
 * @apiDescription Allows regenerate recovery codes.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 * @apiHeader (Authorization) {String} X-Auth-TOTP TOTP or recoveryCode
 * @apiHeaderExample X-Auth-TOTP-Example:
 *     "X-Auth-TOTP: 123456"
 *
 * @apiParam (Payload) {Number} [totp] - time-based one time password or recoveryCode
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function regenerateCodes({ params, auth }) {
  const { totp } = params;
  const { id } = auth.credentials;
  const { redis } = this;
  const ctx = { redis, username: id, totp };

  return Promise
    .bind(ctx)
    .then(getSecret)
    .then(secret => verifyTotp(secret, totp, id))
    .then(generateRecoveryCodes)
    .then(storeData);
};

module.exports.allowed = hasTotp;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const { hash } = require('../../utils/scrypt');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const { checkTotp, generateRecoveryCodes } = require('../../utils/2fa.js');
const { USERS_2FA_RECOVERY } = require('../../constants');

function storeData(recoveryCodes) {
  const redisKeyRecovery = redisKey(USERS_2FA_RECOVERY, this.username);

  return Promise.all(recoveryCodes.map(hash))
    .then(hashes =>
      this.redis
        .pipeline()
        .del(redisKeyRecovery)
        .sadd(redisKeyRecovery, hashes)
        .exec()
        .then(handlePipeline)
        .return({ recoveryCodes, regenerated: true }));
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
module.exports = function regenerateCodes({ auth }) {
  const { id } = auth.credentials;
  const { redis } = this;
  const ctx = { redis, username: id };

  return Promise
    .bind(ctx)
    .then(generateRecoveryCodes)
    .then(storeData);
};

module.exports.tfa = true;
module.exports.allowed = checkTotp;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

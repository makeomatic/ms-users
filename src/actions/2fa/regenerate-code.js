const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const generateRecovery = Promise.promisify(require('2fa').generateBackupCode);
const redisKey = require('../../utils/key');
const hasTotp = require('../../utils/hasTotp.js');
const { verifyTotp } = require('../../utils/2fa.js');
const { USERS_2FA_SECRET, USERS_2FA_RECOVERY } = require('../../constants');

function getSecret(userId) {
  return this.redis
    .get(redisKey(USERS_2FA_SECRET, userId));
}

function storeData(userId, recovery) {
  return this.redis
    .set(redisKey(USERS_2FA_RECOVERY, userId), recovery)
    .return({ recovery, regenerated: true });
}

/**
 * @api {amqp} <prefix>.regenerate-code Regenerate recovery code
 * @apiVersion 1.0.0
 * @apiName RegenerateCode
 * @apiGroup Users
 *
 * @apiDescription Allows regenerate recovery code.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 * @apiHeader (Authorization) {String} X-Auth-TOTP TOTP or recoveryCode
 * @apiHeaderExample X-Auth-TOTP-Example:
 *     "X-Auth-TOTP: 123456"
 *
 * @apiParam (Payload) {Number} [totp] - time-based one time password
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function regenerateCode({ params, auth }) {
  const { totp } = params;
  const { id } = auth.credentials;
  const { redis } = this;

  return Promise
    .bind({ redis }, id)
    .then(getSecret)
    .then(secret => verifyTotp(secret, totp))
    .then(generateRecovery)
    .then(recovery => storeData(id, recovery));
};

module.exports.allowed = hasTotp;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

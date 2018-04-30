const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const generateRecovery = Promise.promisify(require('2fa').generateBackupCode);
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const hasTotp = require('../../utils/hasTotp.js');
const { verifyTotp } = require('../../utils/2fa.js');
const { USERS_2FA_SECRET, USERS_2FA_RECOVERY } = require('../../constants');

function storeData(userId, secret, recovery) {
  const { redis } = this;

  // stores secret and recoveryCode
  const redisKeySecret = redisKey(USERS_2FA_SECRET, userId);
  const redisKeyRecovery = redisKey(USERS_2FA_RECOVERY, userId);

  // prepare to store
  return redis
    .pipeline()
    .set(redisKeySecret, secret)
    .set(redisKeyRecovery, recovery)
    .exec()
    .then(handlePipeline)
    .return({ recovery, enabled: true });
}

/**
 * @api {amqp} <prefix>.attach Attach
 * @apiVersion 1.0.0
 * @apiName Attach
 * @apiGroup Users
 *
 * @apiDescription Allows to attach secret key and recovery code to user's account,
 * generate and returns initial recovery code.
 *
 * @apiHeader (Authorization) {String} Authorization JWT :accessToken
 * @apiHeaderExample Authorization-Example:
 *     "Authorization: JWT my.reallyniceandvalid.jsonwebtoken"
 * @apiHeader (Authorization) {String} X-Auth-TOTP TOTP or recoveryCode
 * @apiHeaderExample X-Auth-TOTP-Example:
 *     "X-Auth-TOTP: 123456"
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String} secret - crypto secure 32 characters hex key
 * @apiParam (Payload) {Number} [totp] - time-based one time password
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function attach({ params }) {
  const { username, secret, totp } = params;
  const { redis } = this;

  return Promise
    .bind({ redis }, [secret, totp])
    .spread(verifyTotp)
    .then(generateRecovery)
    .then(recovery => storeData(username, secret, recovery));
};

module.exports.allowed = hasTotp;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];

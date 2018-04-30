const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const handlePipeline = require('../../utils/pipelineError');
const redisKey = require('../../utils/key');
const verifyTotp = Promise.promisifyAll(require('2fa').verifyTOTP);
const hasTotp = require('../../utils/hasTotp.js');
const { USERS_2FA_SECRET, USERS_2FA_RECOVERY } = require('../../constants');

function getSecretAndRecovery(userId) {
  return this.redis
    .pipeline()
    .get(redisKey(USERS_2FA_SECRET, userId))
    .get(redisKey(USERS_2FA_RECOVERY, userId))
    .exec()
    .then(handlePipeline);
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

  return Promise
    .bind({ redis }, username)
    .then(getSecretAndRecovery)
    .spread((secret, recovery) => verifyTotp(secret, totp, recovery));
};

module.exports.allowed = hasTotp;
module.exports.transports = [ActionTransport.amqp];

const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const { check2FA, generateRecoveryCodes } = require('../../utils/2fa.js');
const { USERS_2FA_RECOVERY, TFA_TYPE_REQUIRED } = require('../../constants');

function storeData(userId) {
  const redisKeyRecovery = redisKey(USERS_2FA_RECOVERY, userId);
  const recoveryCodes = generateRecoveryCodes();

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
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {Number} [totp] - time-based one time password or recoveryCode
 * @apiParam (Payload) {String} [remoteip] - security logging feature, not used
 *
 */
module.exports = function regenerateCodes({ params }) {
  const { username } = params;
  const { redis } = this;

  return Promise
    .bind({ redis }, username)
    .then(storeData);
};

module.exports.tfa = TFA_TYPE_REQUIRED;
module.exports.allowed = check2FA;
module.exports.auth = 'httpBearer';
module.exports.transports = [ActionTransport.http, ActionTransport.amqp];
module.exports.transportOptions = {
  [ActionTransport.http]: {
    methods: ['post'],
  },
  [ActionTransport.amqp]: {
    methods: [ActionTransport.amqp],
  },
};

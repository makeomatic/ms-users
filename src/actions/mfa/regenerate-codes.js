const Promise = require('bluebird');

const { ActionTransport } = require('../../re-export');

const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipeline-error');
const { checkMFA, generateRecoveryCodes } = require('../../utils/mfa');
const { USERS_MFA_RECOVERY, MFA_TYPE_REQUIRED } = require('../../constants');

function storeData(userId) {
  const redisKeyRecovery = redisKey(userId, USERS_MFA_RECOVERY);
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
function regenerateCodes({ locals }) {
  const { username } = locals;
  const { redis } = this;

  return Promise
    .bind({ redis }, username)
    .then(storeData);
}

regenerateCodes.mfa = MFA_TYPE_REQUIRED;
regenerateCodes.allowed = checkMFA;
regenerateCodes.auth = 'httpBearer';
regenerateCodes.transports = [ActionTransport.http, ActionTransport.amqp, ActionTransport.internal];
regenerateCodes.transportOptions = {
  [ActionTransport.http]: {
    methods: ['post'],
  },
};

module.exports = regenerateCodes;

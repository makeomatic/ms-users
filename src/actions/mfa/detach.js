const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const { checkMFA } = require('../../utils/mfa.js');
const {
  USERS_DATA,
  USERS_MFA_FLAG,
  USERS_MFA_RECOVERY,
  MFA_TYPE_REQUIRED,
} = require('../../constants');

async function removeData(userId) {
  return this.redis
    .pipeline()
    .del(redisKey(userId, USERS_MFA_RECOVERY))
    .hdel(redisKey(userId, USERS_DATA), USERS_MFA_FLAG)
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
 * basically disables MFA.
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
function detach({ locals }) {
  const { username } = locals;
  const { redis } = this;

  return Promise
    .bind({ redis }, username)
    .then(removeData);
}

detach.mfa = MFA_TYPE_REQUIRED;
detach.allowed = checkMFA;
detach.auth = 'httpBearer';
detach.transports = [ActionTransport.http, ActionTransport.amqp, ActionTransport.internal];
detach.transportOptions = {
  [ActionTransport.http]: {
    methods: ['post'],
  },
};

module.exports = detach;

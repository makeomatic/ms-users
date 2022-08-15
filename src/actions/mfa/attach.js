const Promise = require('bluebird');

const { ActionTransport } = require('@microfleet/plugin-router');

const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipeline-error');
const { checkMFA, generateRecoveryCodes } = require('../../utils/mfa');
const {
  USERS_DATA,
  USERS_MFA_FLAG,
  USERS_MFA_RECOVERY,
  MFA_TYPE_DISABLED,
} = require('../../constants');

async function storeData(userId) {
  const { redis, secret } = this;
  const recoveryCodes = generateRecoveryCodes();

  return redis
    .pipeline()
    .del(redisKey(userId, USERS_MFA_RECOVERY))
    .sadd(redisKey(userId, USERS_MFA_RECOVERY), recoveryCodes)
    .hset(redisKey(userId, USERS_DATA), USERS_MFA_FLAG, secret)
    .exec()
    .then(handlePipeline)
    .return({ recoveryCodes, enabled: true });
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
function attach({ params, locals }) {
  const { secret } = params;
  const { username } = locals;
  const { redis } = this;
  const ctx = { redis, secret };

  return Promise
    .bind(ctx, username)
    .then(storeData);
}

attach.mfa = MFA_TYPE_DISABLED;
attach.allowed = checkMFA;
attach.auth = 'httpBearer';
attach.validateResponse = false;
attach.transports = [ActionTransport.http, ActionTransport.amqp, ActionTransport.internal];
attach.transportOptions = {
  [ActionTransport.http]: {
    methods: ['post'],
  },
};

module.exports = attach;

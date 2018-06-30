const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');

const redisKey = require('../../utils/key');
const handlePipeline = require('../../utils/pipelineError');
const { check2FA, generateRecoveryCodes } = require('../../utils/2fa.js');
const {
  USERS_DATA,
  USERS_2FA_FLAG,
  USERS_2FA_SECRET,
  USERS_2FA_RECOVERY,
  TFA_TYPE_DISABLED,
} = require('../../constants');

async function storeData(userId) {
  const { redis, secret } = this;
  const recoveryCodes = generateRecoveryCodes();

  return redis
    .pipeline()
    .set(redisKey(USERS_2FA_SECRET, userId), secret)
    .sadd(redisKey(USERS_2FA_RECOVERY, userId), recoveryCodes)
    .hset(redisKey(userId, USERS_DATA), USERS_2FA_FLAG, 'true')
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
module.exports = function attach({ params }) {
  const { username, secret } = params;
  const { redis } = this;
  const ctx = { redis, secret };

  return Promise
    .bind(ctx, username)
    .then(storeData);
};

module.exports.tfa = TFA_TYPE_DISABLED;
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

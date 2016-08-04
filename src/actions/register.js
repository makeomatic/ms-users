const Promise = require('bluebird');
const Errors = require('common-errors');
const setMetadata = require('../utils/updateMetadata.js');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const emailValidation = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const isDisposable = require('../utils/isDisposable.js');
const mxExists = require('../utils/mxExists.js');
const makeCaptchaCheck = require('../utils/checkCaptcha.js');
const userExists = require('../utils/userExists.js');
const aliasExists = require('../utils/aliasExists.js');
const noop = require('lodash/noop');
const assignAlias = require('./alias.js');
const checkLimits = require('../utils/checkIpLimits.js');
const passThrough = require('lodash/constant');
const is = require('is');
const {
  USERS_INDEX,
  USERS_DATA,
  USERS_ACTIVE_FLAG,
  USERS_CREATED_FIELD,
  lockAlias,
  lockRegister,
} = require('../constants.js');

// cached helpers
const hasOwnProperty = Object.prototype.hasOwnProperty;

/**
 * @api {amqp} <prefix>.register Create User
 * @apiVersion 1.0.0
 * @apiName RegisterUser
 * @apiGroup Users
 *
 * @apiDescription Provides ability to register users, with optional throttling, captcha checks & email verification.
 * Based on provided arguments either returns "OK" indicating that user needs to complete challenge or JWT token & user
 * object
 *
 * @apiParam (Payload) {String} username - currently only email is supported
 * @apiParam (Payload) {String} audience - will be used to write metadata to
 * @apiParam (Payload) {String{3..15}} [alias] - alias for username, user will be marked as public. Can only be used when `activate` is `true`
 * @apiParam (Payload) {String} [password] - will be hashed and stored if provided, otherwise generated and sent via email
 * @apiParam (Payload) {Object} [captcha] - google recaptcha container
 * @apiParam (Payload) {String} [captcha.response] - token passed from client to verify at google
 * @apiParam (Payload) {String} [captcha.remoteip] - ip for security check at google
 * @apiParam (Payload) {String} [captcha.secret] - shared secret between us and google
 * @apiParam (Payload) {Object} [metadata] - metadata to be saved into `audience` upon completing registration
 * @apiParam (Payload) {Boolean} [activate=false] - whether to activate the user instantly or not
 * @apiParam (Payload) {String} [ipaddress] - used for security logging
 * @apiParam (Payload) {Boolean} [skipChallenge=false] - if `activate` is `false` disables sending challenge
 */
function registerUser(request) {
  const { redis, config } = this;
  const { deleteInactiveAccounts, captcha: captchaConfig, registrationLimits } = config;

  // request
  const params = request.params;
  const { username, alias, password, audience, ipaddress, skipChallenge, activate } = params;
  const captcha = hasOwnProperty.call(params, 'captcha') ? params.captcha : false;
  const metadata = hasOwnProperty.call(params, 'metadata') ? params.metadata : false;
  const userDataKey = redisKey(username, USERS_DATA);
  const created = Date.now();

  // make sure that if alias is truthy then activate is also truthy
  if (alias && !activate) {
    throw new Errors.HttpStatusError(400, 'Account must be activated when setting alias during registration');
  }

  // 1. perform logic checks
  // 2. acquire registration lock
  // 3. create pipeline that adds all the user data into the system atomically to avoid failures

  let promise = Promise.bind(this, username);

  // optional captcha verification
  if (captcha) {
    promise = promise.tap(makeCaptchaCheck(redis, username, captcha, captchaConfig));
  }

  if (registrationLimits) {
    if (registrationLimits.noDisposable) {
      promise = promise.tap(isDisposable(username));
    }

    if (registrationLimits.checkMX) {
      promise = promise.tap(mxExists(username));
    }

    if (registrationLimits.ip && ipaddress) {
      promise = promise.tap(checkLimits(redis, registrationLimits, ipaddress));
    }
  }

  // acquire lock now!
  return promise
    .then(() => (
      // multi-lock if we need to acquire alias
      this.dlock.multi(lockRegister(username), alias && lockAlias(alias))
    ))
    .then(lock => (
      Promise
        .bind(this, username)
        // do verifications of DB state
        .tap(userExists)
        .throw(new Errors.HttpStatusError(409, `"${username}" already exists`))
        .catchReturn({ statusCode: 404 }, username)
        .tap(alias ? aliasExists(alias, true) : noop)
        // generate password hash
        .then(password ? passThrough(password) : emailValidation.sendPassword)
        .then(ctx => (is.string(ctx) ? ctx : ctx.context.password))
        .then(scrypt.hash)
        // create user
        .then(hash => {
          const pipeline = redis.pipeline();

          // basic internal info
          pipeline.hmset(userDataKey, {
            password: hash,
            [USERS_CREATED_FIELD]: created,
            [USERS_ACTIVE_FLAG]: activate,
          });

          // WARNING: IF USER IS NOT VERIFIED WITHIN <deleteInactiveAccounts>
          // [by default 30] DAYS - IT WILL BE REMOVED FROM DATABASE
          if (!activate && deleteInactiveAccounts >= 0) {
            pipeline.expire(userDataKey, deleteInactiveAccounts);
          }

          return pipeline.exec();
        })
        // basic metadata
        .return({
          username,
          audience,
          metadata: {
            $set: {
              username,
              [USERS_CREATED_FIELD]: created,
              ...metadata || {},
            },
          },
        })
        .then(setMetadata)
        // activate user or queue challenge
        .then(() => {
          // Option 1. Activation
          if (!activate) {
            return Promise
              .bind(this, username)
              .then(skipChallenge ? noop : emailValidation.send)
              .return({ requiresActivation: true });
          }

          // perform instant activation
          return redis
            // internal username index
            .sadd(USERS_INDEX, username)
            // custom actions
            .bind(this)
            .return(['users:activate', username, audience])
            .spread(this.hook)
            // alias if present
            .return({ params: { username, alias, internal: true } })
            .tap(alias ? assignAlias : noop)
            // login & return JWT
            .return([username, audience])
            .spread(jwt.login);
        })
        .finally(() => {
          // don't wait for this to complete
          lock.release().reflect();
          return null;
        })
    ));
}

module.exports = registerUser;

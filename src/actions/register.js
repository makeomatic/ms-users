const Promise = require('bluebird');
const Errors = require('common-errors');
const setMetadata = require('../utils/updateMetadata.js');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const emailValidation = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const uuid = require('node-uuid');
const { USERS_INDEX, USERS_DATA, USERS_ACTIVE_FLAG, MAIL_REGISTER } = require('../constants.js');
const isDisposable = require('../utils/isDisposable.js');
const mxExists = require('../utils/mxExists.js');
const makeCaptchaCheck = require('../utils/checkCaptcha.js');
const userExists = require('../utils/userExists.js');
const aliasExists = require('../utils/aliasExists.js');
const noop = require('lodash/noop');
const assignAlias = require('./alias.js');

/**
 * Verify ip limits
 * @param  {redisCluster} redis
 * @param  {Object} registrationLimits
 * @param  {String} ipaddress
 * @return {Function}
 */
function checkLimits(redis, registrationLimits, ipaddress) {
  const { ip: { time, times } } = registrationLimits;
  const ipaddressLimitKey = redisKey('reg-limit', ipaddress);
  const now = Date.now();
  const old = now - time;

  return function iplimits() {
    return redis
      .pipeline()
      .zadd(ipaddressLimitKey, now, uuid.v4())
      .pexpire(ipaddressLimitKey, time)
      .zremrangebyscore(ipaddressLimitKey, '-inf', old)
      .zcard(ipaddressLimitKey)
      .exec()
      .then(props => {
        const cardinality = props[3][1];
        if (cardinality > times) {
          const msg = 'You can\'t register more users from your ipaddress now';
          throw new Errors.HttpStatusError(429, msg);
        }
      });
  };
}

/**
 * Creates user with a given hash
 */
function createUser(redis, username, activate, deleteInactiveAccounts, userDataKey) {
  /**
   * Input from scrypt.hash
   */
  return function create(hash) {
    const pipeline = redis.pipeline();

    pipeline.hsetnx(userDataKey, 'password', hash);
    pipeline.hsetnx(userDataKey, USERS_ACTIVE_FLAG, activate);

    return pipeline
      .exec()
      .spread(function insertedUserData(passwordSetResponse) {
        if (passwordSetResponse[1] === 0) {
          throw new Errors.HttpStatusError(412, `User "${username}" already exists`);
        }

        if (!activate && deleteInactiveAccounts >= 0) {
          // WARNING: IF USER IS NOT VERIFIED WITHIN <deleteInactiveAccounts>
          // [by default 30] DAYS - IT WILL BE REMOVED FROM DATABASE
          return redis.expire(userDataKey, deleteInactiveAccounts);
        }

        return null;
      });
  };
}

/**
 * Registration handler
 * @param  {Object} message
 * @return {Promise}
 */
module.exports = function registerUser(message) {
  const { redis, config } = this;
  const { deleteInactiveAccounts, captcha: captchaConfig, registrationLimits } = config;

  // message
  const { username, alias, password, audience, ipaddress, skipChallenge, activate } = message;
  const captcha = message.hasOwnProperty('captcha') ? message.captcha : false;
  const metadata = message.hasOwnProperty('metadata') ? message.metadata : false;

  // task holder
  const logger = this.log.child({ username, action: 'register' });

  // make sure that if alias is truthy then activate is also truthy
  if (alias && !activate) {
    throw new Errors.HttpStatusError(400, 'Account must be activated when setting alias during registration');
  }

  let promise = Promise.bind(this, username);

  // optional captcha verification
  if (captcha) {
    logger.debug('verifying captcha');
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

  // shared user key
  const userDataKey = redisKey(username, USERS_DATA);

  // step 2, verify that user _still_ does not exist
  promise = promise
    // verify user does not exist at this point
    .tap(userExists)
    .throw(new Errors.HttpStatusError(409, `"${username}" already exists`))
    .catchReturn({ statusCode: 404 }, username)
    .tap(alias ? aliasExists(alias, true) : noop)
    // step 3 - encrypt password
    .then(() => {
      if (password) {
        return password;
      }

      // if no password was supplied - we auto-generate it and send it to an email that was provided
      // then we hash it and store in the db
      return emailValidation
        .send
        .call(this, username, MAIL_REGISTER)
        .then(ctx => ctx.context.password);
    })
    .then(scrypt.hash)
    // step 4 - create user if it wasn't created by some1 else trying to use race-conditions
    .then(createUser(redis, username, activate, deleteInactiveAccounts, userDataKey))
    // step 5 - save metadata if present
    .return({
      username,
      audience,
      metadata: {
        $set: {
          username,
          ...metadata || {},
        },
      },
    })
    .then(setMetadata)
    .return(username);

  // no instant activation -> send email or skip it based on the settings
  if (!activate) {
    return promise
      .then(skipChallenge ? noop : emailValidation.send)
      .return({ requiresActivation: true });
  }

  // perform instant activation
  return promise
    // add to redis index
    .then(() => redis.sadd(USERS_INDEX, username))
    // call hook
    .return(['users:activate', username, audience])
    .spread(this.hook)
    // assign alias if specified
    .tap(() => {
      if (!alias) {
        return null;
      }

      // adds on-registration alias to the user
      return assignAlias.call(this, { username, alias });
    })
    // login user
    .return([username, audience])
    .spread(jwt.login);
};

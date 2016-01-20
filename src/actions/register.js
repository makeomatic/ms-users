const Promise = require('bluebird');
const Errors = require('common-errors');
const request = require('request-promise');
const defaults = require('lodash/defaults');
const pick = require('lodash/pick');
const setMetadata = require('../utils/updateMetadata.js');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const emailValidation = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const { format: fmt } = require('util');
const disposableDomains = require('disposable-email-domains');
const dns = Promise.promisifyAll(require('dns'));
const uuid = require('node-uuid');

// init pointers
const disposablePointers = {};
disposableDomains.reduce((acc, domain) => {
  disposablePointers[domain] = true;
  return acc;
}, disposablePointers);

/**
 * Checks whether an email is disposable or not and returns a promise
 * @param  {String}  email
 * @return {Boolean}
 */
function isDisposable(email) {
  const domain = email.split('@')[1];
  return function testDisposable() {
    if (disposablePointers[domain]) {
      throw new Errors.HttpStatusError(400, 'you must use non-disposable email to register');
    }
  };
}

/**
 * Checks whether MX record exists or not
 * @param  {String} email
 * @return {Promise}
 */
function mxExists(email) {
  const hostname = email.split('@').pop();
  const tld = hostname.split('.').slice(-2).join('.');

  return function check() {
    return dns
      .resolveMxAsync(tld)
      .catchReturn({ code: 'ENOTFOUND' }, [])
      .catchReturn({ code: 'ENODATA' }, [])
      .then(addresses => {
        if (addresses && addresses.length > 0) {
          return null;
        }

        throw new Errors.HttpStatusError(400, `no MX record was found for hostname ${hostname}`);
      });
  };
}

/**
 * Performs captcha check, returns thukn
 * @param  {redisCluster} redis
 * @param  {String} username
 * @param  {String} captcha
 * @param  {Object} captchaConfig
 * @return {Function}
 */
function makeCaptchaCheck(redis, username, captcha, captchaConfig) {
  const { secret, ttl, uri } = captchaConfig;
  return function checkCaptcha() {
    const captchaCacheKey = captcha.response;
    return redis.pipeline()
      .set(captchaCacheKey, username, 'EX', ttl, 'NX')
      .get(captchaCacheKey)
      .exec()
      .spread(function captchaCacheResponse(setResponse, getResponse) {
        if (getResponse[1] !== username) {
          const msg = 'Captcha challenge you\'ve solved can not be used, please complete it again';
          throw new Errors.HttpStatusError(412, msg);
        }
      })
      .then(function verifyGoogleCaptcha() {
        return request.post({ uri, qs: defaults(captcha, { secret }), json: true })
          .then(function captchaSuccess(body) {
            if (!body.success) {
              return Promise.reject({ statusCode: 200, error: body });
            }

            return true;
          })
          .catch(function captchaError(err) {
            const errData = JSON.stringify(pick(err, ['statusCode', 'error']));
            throw new Errors.HttpStatusError(412, fmt('Captcha response: %s', errData));
          });
      });
  };
}

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
    return redis.pipeline()
      .zadd(ipaddressLimitKey, now, uuid.v4())
      .pexpire(ipaddressLimitKey, time)
      .zremrangebyscore(ipaddressLimitKey, '-inf', old)
      .zcard(ipaddressLimitKey)
      .exec()
      .then(props => {
        const cardinality = props[3][1];
        if (cardinality > times) {
          const msg = `You can't register more users from your ipaddress now`;
          throw new Errors.HttpStatusError(429, msg);
        }
      });
  };
}

/**
 * Atomically check that at this point user still does not exist
 * @return {Function}
 */
function userDoesntExist(redis, username, userDataKey) {
  return function check() {
    return redis
      .hexists(userDataKey, 'password')
      .then(function userExists(exists) {
        if (exists) {
          throw new Errors.HttpStatusError(403, `"${username}" already exists`);
        }

        return true;
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
    pipeline.hsetnx(userDataKey, 'active', activate);

    return pipeline
      .exec()
      .spread(function insertedUserData(passwordSetResponse) {
        if (passwordSetResponse[1] === 0) {
          throw new Errors.HttpStatusError(403, `User "${username}" already exists`);
        }

        if (!activate && deleteInactiveAccounts >= 0) {
          // WARNING: IF USER IS NOT VERIFIED WITHIN <deleteInactiveAccounts>
          // [by default 30] DAYS - IT WILL BE REMOVED FROM DATABASE
          return redis.expire(userDataKey, deleteInactiveAccounts);
        }
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
  const { username, password, audience, ipaddress, skipChallenge } = message;
  const activate = message.hasOwnProperty('activate') ? message.activate : true;
  const captcha = message.hasOwnProperty('captcha') ? message.captcha : false;
  const metadata = message.hasOwnProperty('metadata') ? message.metadata : false;

  // task holder
  const logger = this.log.child({ username, action: 'register' });

  let promise = Promise.bind(this);

  // optional captcha verification
  if (captcha) {
    logger.debug('verifying captcha');
    promise = promise.then(makeCaptchaCheck(redis, username, captcha, captchaConfig));
  }

  if (registrationLimits) {
    if (registrationLimits.noDisposable) {
      promise = promise.then(isDisposable(username));
    }

    if (registrationLimits.checkMX) {
      promise = promise.then(mxExists(username));
    }

    if (registrationLimits.ip && ipaddress) {
      promise = promise.then(checkLimits(redis, registrationLimits, ipaddress));
    }
  }

  // shared user key
  const userDataKey = redisKey(username, 'data');

  // step 2, verify that user _still_ does not exist
  promise = promise.then(userDoesntExist(redis, username, userDataKey));

  // step 3 - encrypt password
  promise = promise.return(password).then(scrypt.hash);

  // step 4 - create user if it wasn't created by some1 else trying to use race-conditions
  promise = promise
    .then(createUser(redis, username, activate, deleteInactiveAccounts, userDataKey));

  // step 5 - save metadata if present
  promise = promise.then(function insertMetadata() {
    return setMetadata.call(this, {
      username,
      audience,
      metadata: {
        $set: {
          username,
          ...metadata || {},
        },
      },
    });
  });

  if (!activate) {
    promise = promise.then(function sendChallenge() {
      if (skipChallenge !== true) {
        emailValidation.send.call(this, username);
      }

      return {
        requiresActivation: true,
      };
    });
  } else {
    promise = promise.tap(function hook() {
      logger.debug('calling posthook with %s and %s', username, audience);
      return this.postHook('users:activate', username, audience);
    })
    .then(function activateAndLogin() {
      return redis.sadd(config.redis.userSet, username);
    })
    .then(function login() {
      logger.debug('returning activated user');
      return jwt.login.call(this, username, audience);
    });
  }

  return promise;
};

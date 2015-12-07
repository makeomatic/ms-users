const Promise = require('bluebird');
const Errors = require('common-errors');
const request = require('request-promise');
const ld = require('lodash');
const setMetadata = require('../utils/updateMetadata.js');
const scrypt = require('../utils/scrypt.js');
const redisKey = require('../utils/key.js');
const emailValidation = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const { format: fmt } = require('util');

/**
 * Registration handler
 * @param  {Object} message
 * @return {Promise}
 */
module.exports = function registerUser(message) {
  const { redis, config } = this;
  const { deleteInactiveAccounts, captcha: captchaConfig } = config;
  const { secret, ttl, uri } = captchaConfig;

  // message
  const { username, password, audience, ipaddress } = message;
  const activate = message.hasOwnProperty('activate') ? message.activate : true;
  const captcha = message.hasOwnProperty('captcha') ? message.captcha : false;
  const metadata = message.hasOwnProperty('metadata') ? message.metadata : false;

  // task holder
  const logger = this.log.child({ username, action: 'register' });

  let promise = Promise.bind(this);

  // optional captcha verification
  if (captcha) {
    logger.debug('verifying captcha');

    promise = promise.then(function checkCaptcha() {
      const captchaCacheKey = captcha.response;
      return redis.pipeline()
        .set(captchaCacheKey, username, 'EX', ttl, 'NX')
        .get(captchaCacheKey)
        .exec()
        .spread(function captchaCacheResponse(setResponse, getResponse) {
          if (getResponse[1] !== username) {
            throw new Errors.HttpStatusError(412, 'Captcha challenge you\'ve solved can not be used, please complete it again');
          }
        })
        .then(function verifyGoogleCaptcha() {
          return request.post({ uri, qs: ld.defaults(captcha, { secret }), json: true })
            .then(function captchaSuccess(body) {
              if (!body.success) {
                return Promise.reject({ statusCode: 200, error: body });
              }

              return true;
            })
            .catch(function captchaError(err) {
              const errData = JSON.stringify(ld.pick(err, [ 'statusCode', 'error' ]));
              throw new Errors.HttpStatusError(412, fmt('Captcha response: %s', errData));
            });
        });
    });
  }

  if (ipaddress) {
    // TODO:
    // add reg per ip address limits
  }

  // shared user key
  const userDataKey = redisKey(username, 'data');

  // step 2, verify that user _still_ does not exist
  promise = promise.then(function userDoesntExist() {
    logger.debug('Verifying user existance');

    return redis
      .hexists(userDataKey, 'password')
      .then(function userExists(exists) {
        if (exists) {
          throw new Errors.HttpStatusError(403, `"${username}" already exists`);
        }

        return true;
      });
  });

  // step 3 - encrypt password
  promise = promise
    .tap(function logProgress() {
      logger.debug('hashing password');
    })
    .return(password)
    .then(scrypt.hash);

  // step 4 - create user if it wasn't created by some1 else trying to use race-conditions
  promise = promise.then(function createUser(hash) {
    logger.debug('inserting user');

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
          // WARNING: IF USER IS NOT VERIFIED WITHIN <deleteInactiveAccounts>[by default 30] DAYS - IT WILL BE REMOVED FROM DATABASE
          return redis.expire(userDataKey, deleteInactiveAccounts);
        }
      });
  });

  // step 5 - save metadata if present
  promise = promise.then(function insertMetadata() {
    if (!metadata) {
      return null;
    }

    logger.debug('inserting metadata');
    return setMetadata.call(this, {
      username,
      audience,
      metadata: {
        $set: metadata,
      },
    });
  });

  // step 6 - generate JWT token or return success
  promise = promise.then(function generateTokenAndUserObject() {
    if (!activate) {
      logger.debug('sending activation email');

      emailValidation.send.call(this, username);

      return {
        requiresActivation: true,
      };
    }

    return redis.sadd(config.redis.userSet, username)
      .then(() => {
        logger.debug('returning activated user');
        return jwt.login.call(this, username, audience);
      });
  });

  return promise;
};

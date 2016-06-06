const Promise = require('bluebird');
const Errors = require('common-errors');
const scrypt = require('../utils/scrypt.js');
const emailValidation = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const uuid = require('node-uuid');
const { MAIL_REGISTER } = require('../constants.js');

const isDisposable = require('../utils/isDisposable.js');
const mxExists = require('../utils/mxExists.js');
const aliasExists = require('../utils/aliasExists.js');
const noop = require('lodash/noop');
const assignAlias = require('./alias.js');

const Users = require('../adapter');

/**
 * Registration handler
 * @param  {Object} message
 * @return {Promise}
 */
module.exports = function registerUser(message) {
  const {  config } = this;
  const { registrationLimits } = config;

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
    promise = promise.tap(Users.checkCaptcha(username, captcha));
  }

  if (registrationLimits) {
    if (registrationLimits.noDisposable) {
      promise = promise.tap(isDisposable(username));
    }

    if (registrationLimits.checkMX) {
      promise = promise.tap(mxExists(username));
    }

    if (registrationLimits.ip && ipaddress) {
      promise = promise.tap(Users.checkLimits(ipaddress));
    }
  }

  // step 2, verify that user _still_ does not exist
  promise = promise
    // verify user does not exist at this point
    .tap(Users.isExists)
    .throw(new Errors.HttpStatusError(409, `"${username}" already exists`))
    .catchReturn({ statusCode: 404 }, username)
    .tap(alias ? () => Users.aliasAlreadyExists(alias) : noop)
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
    .then(Users.createUser(username, activate))
    // step 5 - save metadata if present
    .return({
      username,
      audience,
      metadata: {
        $set: {
          username,
          ...metadata || {}
        }
      }
    })
    .then(Users.updateMetadata)
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
    .then(() => Users.storeUsername(username))
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

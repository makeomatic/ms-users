/**
 * Created by Stainwoortsel on 17.06.2016.
 */
const Promise = require('bluebird');
const storage = require('./storages/redisstorage');
const { ModelError, ERR_ATTEMPTS_LOCKED } = require('./modelError');
const moment = require('moment');

/**
 * Adapter pattern class with user model methods
 */
exports.User = {

  /**
   * Initialize the model
   */
  init() {
    storage.User.init.call(this);
  },

  /**
   * Get user by username
   * @param username
   * @returns {Object}
     */
  getOne(username) {
    return storage.User.getOne.call(this, username);
  },

  /**
   * Get list of users by params
   * @param opts
   * @returns {Array}
     */
  getList(opts) {
    return storage.User.getList.call(this, opts);
  },

  /**
   * Get metadata of user
   * @param username
   * @param audiences
   * @param fields
   * @param _public
   * @returns {Object}
     */
  getMeta(username, audiences, fields = {}, _public = null) {
    return storage.User.getMeta.call(this, username, audiences, fields, _public);
  },

  /**
   * Get ~real~ username by username or alias
   * @param username
   * @returns {String} username
     */
  getUsername(username) {
    return storage.User.getUsername.call(this, username);
  },

  /**
   * Check alias existence
   * @param alias
   * @returns {*}
     */
  checkAlias(alias) {
    return storage.User.checkAlias.call(this, alias);
  },

  /**
   * Sets alias to the user by username
   * @param opts
   * @returns {*}
     */
  setAlias(opts) {
    return storage.User.setAlias.call(this, opts);
  },

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {String} username
   */
  setPassword(username, hash) {
    return storage.User.setPassword.call(this, username, hash);
  },

  /**
   * Updates metadata of user by username and audience
   * @param username
   * @param audience
   * @param metadata
   * @returns {Object}
   */
  setMeta(opts) {
    return storage.User.setMeta.call(this, opts);
  },

  /**
   * Create user account with alias and password
   * @param username
   * @param alias
   * @param hash
   * @param activate
   * @returns {*}
     */
  create(username, alias, hash, activate) {
    return storage.User.create.call(this, username, alias, hash, activate);
  },

  /**
   * Remove user
   * @param username
   * @param data
   * @returns {*}
     */
  remove(username, data) {
    return storage.User.remove.call(this, username, data);
  },

  /**
   * Activate user
   * @param username
   * @returns {*}
     */
  activate(username) {
    return storage.User.activate.call(this, username);
  },

  /**
   * Disactivate user
   * @param username
   * @returns {*}
   */
  disactivate(username) {
    return storage.User.disactivate.call(this, username);
  },

  /**
   * Ban user
   * @param username
   * @param opts
   * @returns {*}
     */
  lock(opts) {
    return storage.User.lock.call(this, opts);
  },

  /**
   * Unlock banned user
   * @param opts
   * @returns {*}
     */
  unlock(opts) {
    return storage.User.unlock.call(this, opts);
  },
};

/**
 * Adapter pattern class for user login attempts counting
 */
class AttemptsClass {
  /**
   * Attempts class constructor, _context parameter is the context of service
   * @param _context
   */
  constructor(_context) {
    this.context = _context;
    this.loginAttempts = 0;
  }

  /**
   * Check login attempts
   * @param username
   * @param ip
   * @returns {*}
     */
  check(username, ip) {
    const { config: { jwt: { lockAfterAttempts }, keepLoginAttempts } } = this.context;
    return Promise.bind(this.context, { username, ip })
      .then(storage.Attempts.check)
      .then((attempts) => {
        if (attempts === null) return;

        this.loginAttempts = attempts;
        if (this.loginAttempts > lockAfterAttempts) {
          const duration = moment().add(keepLoginAttempts, 'seconds').toNow(true);
          const verifyIp = ip && lockAfterAttempts > 0;

          const err = new ModelError(ERR_ATTEMPTS_LOCKED, duration);
          if (verifyIp) {
            err.loginAttempts = this.loginAttempts;
          }

          throw err;
        }
      });
  }

  /**
   * Drop login attempts
   * @param username
   * @param ip
   * @returns {*}
     */
  drop(username, ip) {
    this.loginAttempts = 0;
    return storage.Attempts.drop.call(this.context, username, ip);
  }

  /**
   * Get attempts count
   * @returns {integer}
     */
  count() {
    return this.loginAttempts;
  }
}
exports.Attempts = AttemptsClass;

  /**
 * Adapter pattern class for user tokens
 */
exports.Tokens = {
  /**
   * Add the token
   * @param username
   * @param token
   * @returns {*}
   */
  add(username, token) {
    return storage.Tokens.add.call(this, username, token);
  },

  /**
   * Drop the token
   * @param username
   * @param token
   * @returns {*}
   */
  drop(username, token = null) {
    return storage.Tokens.drop.call(this, username, token);
  },

  /**
   * Get last token score
   * @param username
   * @param token
   * @returns {integer}
   */
  lastAccess(username, token) {
    return storage.Tokens.lastAccess.call(this, username, token);
  },

  /**
   * Get special email throttle state
   * @param type
   * @param email
   * @returns {bool} state
     */
  getEmailThrottleState(type, email) {
    return storage.Tokens.getEmailThrottleState.call(this, type, email);
  },

  /**
   * Set special email throttle state
   * @param type
   * @param email
   * @returns {*}
     */
  setEmailThrottleState(type, email) {
    return storage.Tokens.setEmailThrottleState.call(this, type, email);
  },

  /**
   * Get special email throttle token
   * @param type
   * @param token
   * @returns {string} email
     */
  getEmailThrottleToken(type, token) {
    return storage.Tokens.getEmailThrottleToken.call(this, type, token);
  },

  /**
   * Set special email throttle token
   * @param type
   * @param email
   * @param token
   * @returns {*}
     */
  setEmailThrottleToken(type, email, token) {
    return storage.Tokens.setEmailThrottleToken.call(this, type, email, token);
  },

  /**
   * Drop special email throttle token
   * @param type
   * @param token
   * @returns {*}
     */
  dropEmailThrottleToken(type, token) {
    return storage.Tokens.dropEmailThrottleToken.call(this, type, token);
  },
};

/**
 * Adapter pattern class for util methods with IP
 */
exports.Utils = {
  /**
   * Check IP limits for registration
   * @param ipaddress
   * @returns {*}
   */
  checkIPLimits(ipaddress) {
    return storage.Utils.checkIPLimits.call(this, ipaddress);
  },

  /**
   * Check captcha
   * @param username
   * @param captcha
   * @param next
   * @returns {*}
   */
  checkCaptcha(username, captcha, next = null) {
    return storage.Utils.checkCaptcha.call(this, username, captcha, next);
  },
};

/**
 * Created by Stainwoortsel on 17.06.2016.
 */
const storage = require('./storages/redisstorage');

/**
 * Adapter pattern class with user model methods
 */
class UserModel {
  /**
   * Create user model
   * @param adapter
   */
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Get user by username
   * @param username
   * @returns {Object}
     */
  getOne(username) {
    return this.adapter.getOne(username);
  }

  /**
   * Get list of users by params
   * @param opts
   * @returns {Array}
     */
  getList(opts) {
    return this.adapter.getList(opts);
  }

  /**
   * Get metadata of user
   * @param username
   * @param audiences
   * @param fields
   * @param _public
   * @returns {Object}
     */
  getMeta(username, audiences, fields = {}, _public = null) {
    return this.adapter.getMeta(username, audiences, fields, _public);
  }

  /**
   * Get ~real~ username by username or alias
   * @param username
   * @returns {String} username
     */
  getUsername(username) {
    return this.adapter.getUsername(username);
  }

  /**
   * Check alias existence
   * @param alias
   * @returns {*}
     */
  checkAlias(alias) {
    return this.adapter.checkAlias(alias);
  }

  /**
   * Sets alias to the user by username
   * @param username
   * @param alias
   * @returns {*}
     */
  setAlias(username, alias) {
    return this.adapter.setAlias(username, alias);
  }

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {String} username
   */
  setPassword(username, hash) {
    return this.adapter.setPassword(username, hash);
  }

  /**
   * Updates metadata of user by username and audience
   * @param username
   * @param audience
   * @param metadata
   * @returns {Object}
   */
  setMeta(username, audience, metadata) {
    return this.adapter.setMeta(username, audience, metadata);
  }

  /**
   * Update meta of user by using direct script
   * @param username
   * @param audience
   * @param script
   * @returns {Object}
   */
  executeUpdateMetaScript(username, audience, script) {
    return this.adapter.executeUpdateMetaScript(username, audience, script);
  }

  /**
   * Create user account with alias and password
   * @param username
   * @param alias
   * @param hash
   * @param activate
   * @returns {*}
     */
  create(username, alias, hash, activate) {
    return this.adapter.create(username, alias, hash, activate);
  }

  /**
   * Remove user
   * @param username
   * @param data
   * @returns {*}
     */
  remove(username, data) {
    return this.adapter.remove(username, data);
  }

  /**
   * Activate user
   * @param username
   * @returns {*}
     */
  activate(username) {
    return this.adapter.activate(username);
  }

  /**
   * Ban user
   * @param username
   * @param opts
   * @returns {*}
     */
  lock(username, opts) {
    return this.adapter.lock(username, opts);
  }

  /**
   * Unlock banned user
   * @param username
   * @returns {*}
     */
  unlock(username) {
    return this.adapter.unlock(username);
  }
}

/**
 * Adapter pattern class for user login attempts counting
 */
class AttemptsHelper {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Check login attempts
   * @param username
   * @param ip
   * @returns {*}
     */
  check({ username, ip }) {
    return this.adapter.check({ username, ip });
  }

  /**
   * Drop login attempts
   * @param username
   * @param ip
   * @returns {*}
     */
  drop(username, ip) {
    return this.adapter.drop(username, ip);
  }

  /**
   * Get attempts count
   * @returns {integer}
     */
  count() {
    return this.adapter.count();
  }
}

/**
 * Adapter pattern class for user tokens
 */
class TokensHelper {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Add the token
   * @param username
   * @param token
   * @returns {*}
   */
  add(username, token) {
    return this.adapter.add(username, token);
  }

  /**
   * Drop the token
   * @param username
   * @param token
   * @returns {*}
   */
  drop(username, token = null) {
    return this.adapter.drop(username, token);
  }

  /**
   * Get last token score
   * @param username
   * @param token
   * @returns {integer}
   */
  lastAccess(username, token) {
    return this.adapter.count(username, token);
  }

  /**
   * Get special email throttle state
   * @param type
   * @param email
   * @returns {bool} state
     */
  getEmailThrottleState(type, email) {
    return this.adapter.getEmailThrottleState(type, email);
  }

  /**
   * Set special email throttle state
   * @param type
   * @param email
   * @returns {*}
     */
  setEmailThrottleState(type, email) {
    return this.adapter.setEmailThrottleState(type, email);
  }

  /**
   * Get special email throttle token
   * @param type
   * @param token
   * @returns {string} email
     */
  getEmailThrottleToken(type, token) {
    return this.adapter.getEmailThrottleToken(type, token);
  }

  /**
   * Set special email throttle token
   * @param type
   * @param email
   * @param token
   * @returns {*}
     */
  setEmailThrottleToken(type, email, token) {
    return this.adapter.setEmailThrottleToken(type, email, token);
  }

  /**
   * Drop special email throttle token
   * @param type
   * @param token
   * @returns {*}
     */
  dropEmailThrottleToken(type, token) {
    return this.adapter.dropEmailThrottleToken(type, token);
  }
  
}

/**
 * Adapter pattern class for util methods with IP
 */
class Utils {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Check IP limits for registration
   * @param ipaddress
   * @returns {*}
   */
  checkIPLimits(ipaddress) {
    return this.adapter.checkIPLimits(ipaddress);
  }

  /**
   * Check captcha
   * @param username
   * @param captcha
   * @param next
   * @returns {*}
   */
  checkCaptcha(username, captcha, next = null) {
    return this.adapter.checkCaptcha(username, captcha, next);
  }
}

exports.User = new UserModel(storage.User);
exports.Attempts = new AttemptsHelper(storage.Attempts);
exports.Tokens = new TokensHelper(storage.Tokens);
exports.Utils = new Utils(storage.Utils);

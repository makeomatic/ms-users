/**
 * Created by Stainwoortsel on 30.05.2016.
 */
const RedisStorage = require('./redisstorage');
const Errors = require('common-errors');

class Users {
  constructor(adapter) {
    this.adapter = adapter;
  }

  /**
   * Lock user
   * @param username
   * @param reason
   * @param whom
   * @param remoteip
   * @returns {Redis}
   */
  lockUser({ username, reason, whom, remoteip }) {
    return this.adapter.lockUser({ username, reason, whom, remoteip });
  }

  /**
   * Unlock user
   * @param username
   * @returns {Redis}
   */
  unlockUser(username) {
    return this.adapter.unlockUser(username);
  }

  /**
   * Check existance of user
   * @param username
   * @returns {Redis}
   */
  isExists(username) {
    return this.adapter.isExists(username);
  }

  aliasAlreadyExists(alias, thunk) {
    return this.adapter.aliasAlreadyExists(alias, thunk);
  }

  /**
   * User is public
   * @param username
   * @param audience
   * @returns {function()}
   */
  isPublic(username, audience) {
    return this.adapter.isPublic(username, audience);
  }

  /**
   * Check that user is active
   * @param data
   * @returns {boolean}
   */
  isActive(data) {
    return this.adapter.isActive(data);
  }

  /**
   * Check that user is banned
   * @param data
   * @returns {Promise}
   */
  isBanned(data) {
    return this.adapter.isBanned(data);
  }

  /**
   * Activate user account
   * @param user
   * @returns {Redis}
   */
  activateAccount(user) {
    return this.adapter.activateAccount(user);
  }

  /**
   * Get user internal data
   * @param username
   * @returns {Object}
   */
  getUser(username) {
    return this.adapter.getUser(username);
  }

  /**
   * Get users metadata by username and audience
   * @param username
   * @param audience
   * @returns {Object}
   */

  getMetadata(username, _audiences, fields = {}) {
    return this.adapter.getMetadata(username, _audiences, fields);
  }


  /**
   * Return the list of users by specified params
   * @param opts
   * @returns {Array}
   */
  getList(opts) {
    return this.adapter.getList(opts);
  }

  /**
   * Check that user is admin
   * @param meta
   * @returns {boolean}
   */
  isAdmin(meta) {
    return this.adapter.isAdmin(meta);
  }

  /**
   * Make the linkage between username and alias into the USERS_ALIAS_TO_LOGIN
   * @param username
   * @param alias
   * @returns {Redis}
   */
  storeAlias(username, alias) {
    return this.adapter.storeAlias(username, alias);
  }

  /**
   * Assign alias to the user record, marked by username
   * @param username
   * @param alias
   * @returns {Redis}
   */
  assignAlias(username, alias) {
    return this.adapter.assignAlias(username, alias);
  }

  /**
   * Return current login attempts count
   * @returns {int}
   */
  getAttempts() {
    return this.adapter.getAttempts();
  }

  /**
   * Drop login attempts counter
   * @returns {Redis}
   */
  dropAttempts() {
    return this.adapter.dropAttempts();
  }

  /**
   * Check login attempts
   * @param data
   * @returns {Redis}
   */
  checkLoginAttempts(data) {
    return this.adapter.checkLoginAttempts(data);
  }

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {Redis}
   */
  setPassword(username, hash) {
    return this.adapter.setPassword(username, hash);
  }

  /**
   * Reset the lock by IP
   * @param username
   * @param ip
   * @returns {Redis}
   */
  resetIPLock(username, ip) {
    return this.adapter.resetIPLock(username, ip);
  }

  /**
   *
   * @param username
   * @param audience
   * @param metadata
   * @returns {Object}
   */
  updateMetadata({ username, audience, metadata }) {
    return this.adapter.updateMetadata({ username, audience, metadata });
  }

  /**
   * Removing user by username (and data?)
   * @param username
   * @param data
   * @returns {Redis}
   */
  removeUser(username, data) {
    return this.adapter.removeUser(username, data);
  }

  /**
   * Verify ip limits
   * @param  {redisCluster} redis
   * @param  {Object} registrationLimits
   * @param  {String} ipaddress
   * @return {Function}
   */
  checkLimits(registrationLimits, ipaddress) {
    return this.adapter.checkLimits(registrationLimits, ipaddress);
  }

  /**
   * Creates user with a given hash
   * @param redis
   * @param username
   * @param activate
   * @param deleteInactiveAccounts
   * @param userDataKey
   * @returns {Function}
   */
  createUser(username, activate, deleteInactiveAccounts) {
    return this.adapter.createUser(username, activate, deleteInactiveAccounts);
  }

  /**
   * Performs captcha check, returns thukn
   * @param  {String} username
   * @param  {String} captcha
   * @param  {Object} captchaConfig
   * @return {Function}
   */
  checkCaptcha(username, captcha) {
    return this.adapter.checkCaptcha(username, captcha);
  }

  /**
   * Stores username to the index set
   * @param username
   * @returns {Redis}
   */
  storeUsername(username) {
    return this.adapter.storeUsername(username);
  }

  /**
   * Running a custom script or query
   * @param script
   * @returns {*|Promise}
     */

  customScript(script) {
    return this.adapter.customScript(script);
  }

  /**
   * The error wrapper for the front-level HTTP output
   * @param e
   */
  static mapErrors(e) {
    const err = new Errors.HttpStatusError(e.status_code || 500, e.message);
    if (err.status_code >= 500) {
      err.message = Errors.HttpStatusError.message_map[500]; // hide the real error from the user
    }
  }

}

module.exports = function modelCreator() {
  return new Users(RedisStorage);
};

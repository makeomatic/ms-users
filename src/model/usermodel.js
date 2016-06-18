/**
 * Created by Stainwoortsel on 17.06.2016.
 */
const storage = require('./storages/redisstorage');


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
   * @returns {Object}
     */
  getMeta(username, audiences, fields = {}) {
    return this.adapter.getMeta(username, audiences, fields);
  }

  /**
   * Get ~real~ username by username or alias
   * @param username
   * @returns {String} username
     */
  getUsername(username) {
    return this.adapter.getUsername(username);
  }

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

class AttemptsHelper {

  constructor(adapter) {
    this.adapter = adapter;
  }

  check(username, ip) {
    return this.adapter.check(username, ip);
  }

  drop(username, ip) {
    return this.adapter.drop(username, ip);
  }

  count() {
    return this.adapter.count();
  }

}

module.exports.User = new UserModel(storage.User);
module.exports.Attempts = new AttemptsHelper(storage.Attempts);

/**
 * Created by Stainwoortsel on 30.05.2016.
 */
const Promise = require('bluebird');
const Adapter = require('./redisadapter');
const users = new Adapter();

/**
 * Bans/unbans existing user
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function banUser(opts) {
  return Promise
    .bind(this, opts.username)
    .then(users.userExists)
    .then(username => ({ ...opts, username }))
    .then(opts.ban ? users.lockUser : users.unlockUser);
};

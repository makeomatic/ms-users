const Promise = require('bluebird');
const { User } = require('../model/usermodel');

/**
 * Bans/unbans existing user
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function banUser(opts) {
  return Promise
    .bind(this, opts.username)
    .then(User.getUsername)
    .then(username => ({ ...opts, username }))
    .then(opts.ban ? User.lock : User.unlock);
};

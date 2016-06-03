const Promise = require('bluebird');
const Users = require('../db/adapter');

function lockUser({ username, reason, whom, remoteip }) {
  return Users.lockUser({
    username,
    reason: reason || '',
    whom: whom || '',
    remoteip: remoteip || ''
  })
}

function unlockUser({ username }) {
  return Users.unlockUser({username});
}

/**
 * Bans/unbans existing user
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function banUser(opts) {
  return Promise
    .bind(this, opts.username)
    .then(Users.isExists)
    .then(username => ({ ...opts, username }))
    .then(opts.ban ? lockUser : unlockUser);
};

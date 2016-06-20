const Promise = require('bluebird');
const { User } = require('../model/usermodel');
const { httpErrorMapper } = require('../model/modelError');

/**
 * Bans/unbans existing user
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function banUser(opts) {
  return Promise
    .bind(this, opts.username)
    .then(User.getUsername)
    .then(username => ({ username, opts }))
    .then(opts.ban ? User.lock : User.unlock)
    .catch(e => { throw httpErrorMapper(e); });
};

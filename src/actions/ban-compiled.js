'use strict';

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

const Promise = require('bluebird');
const Users = require('../db/adapter');

function lockUser({ username, reason, whom, remoteip }) {
  return Users.lockUser({
    username,
    reason: reason || '',
    whom: whom || '',
    remoteip: remoteip || ''
  });
}

function unlockUser({ username }) {
  return Users.unlockUser({ username });
}

/**
 * Bans/unbans existing user
 * @param  {Object} opts
 * @return {Promise}
 */
module.exports = function banUser(opts) {
  return Promise.bind(this, opts.username).then(Users.isExists).then(username => _extends({}, opts, { username })).then(opts.ban ? lockUser : unlockUser);
};

//# sourceMappingURL=ban-compiled.js.map
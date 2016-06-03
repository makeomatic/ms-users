const Promise = require('bluebird');
const Errors = require('common-errors');

const Users = require('../db/adapter');


module.exports = function assignAlias(opts) {
  const { username, alias } = opts;

  return Promise
    .bind(this, username)
    .then(Users.getUser)
    .tap(Users.isActive)
    .tap(Users.isBanned)
    .then(data => {
      if (Users.isAliasAssigned(data)) {
        throw new Errors.HttpStatusError(417, 'alias is already assigned');
      }

      return Users.storeAlias(username, alias);
    })
    .then(assigned => {
      if (assigned === 0) {
        throw new Errors.HttpStatusError(409, 'alias was already taken');
      }

      return Users.assignAlias(username, alias);
    });
};

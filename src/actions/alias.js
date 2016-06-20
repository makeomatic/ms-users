const Promise = require('bluebird');
const isActive = require('../utils/isActive');
const isBanned = require('../utils/isBanned');

const { User } = require('../model/usermodel');
const { httpErrorMapper } = require('../model/modelError');


module.exports = function assignAlias(opts) {
  const { username, alias } = opts;

  return Promise
    .bind(this, username)
    .then(User.getOne)
    .tap(isActive)
    .tap(isBanned)
    .then(data => ({ username, alias, data }))
    .then(User.User.setAlias)
    .catch(e => { throw httpErrorMapper(e); });
};

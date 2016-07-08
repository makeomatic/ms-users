const Promise = require('bluebird');
const { User } = require('../model/usermodel');

module.exports = function iterateOverActiveUsers(opts) {
  return Promise
    .bind(this, opts)
    .then(User.getList);
};

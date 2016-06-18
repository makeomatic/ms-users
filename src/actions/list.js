const Promise = require('bluebird');
const { User } = require('../model/usermodel');
const { ModelError } = require('../model/modelError');


module.exports = function iterateOverActiveUsers(opts) {
  return Promise
    .bind(this, opts)
    .then(User.getList)
    .catch(e => { throw (e instanceof ModelError ? e : e.mapToHttp); });
};

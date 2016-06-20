const Promise = require('bluebird');
const { User } = require('../model/usermodel');
const { httpErrorMapper } = require('../model/modelError');


module.exports = function iterateOverActiveUsers(opts) {
  return Promise
    .bind(this, opts)
    .then(User.getList)
    .catch(e => { throw httpErrorMapper(e); });
};

const Promise = require('bluebird');
const { USERS_ADMIN_ROLE } = require('../constants');
const { User } = require('../model/usermodel');
const { ModelError, httpErrorMapper, ERR_ADMIN_IS_UNTOUCHABLE } = require('../model/modelError');


module.exports = function removeUser({ username }) {
  const audience = this.config.jwt.defaultAudience;

  return Promise.props({
    internal: User.getOne.call(this, username),
    meta: User.getMeta.call(this, username, audience),
  })
  .then(({ internal, meta }) => {
    const isAdmin = (meta[audience].roles || []).indexOf(USERS_ADMIN_ROLE) >= 0;
    if (isAdmin) {
      throw new ModelError(ERR_ADMIN_IS_UNTOUCHABLE);
    }

    return User.remove.call(this, username, internal);
  })
  .catch(e => { throw httpErrorMapper(e); });
};

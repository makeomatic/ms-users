const Promise = require('bluebird');
const Errors = require('common-errors');
const key = require('../utils/key');
const { USERS_ADMIN_ROLE } = require('../constants');

const Users = require('../db/adapter');

module.exports = function removeUser({ username }) {
  const audience = this.config.jwt.defaultAudience;

  return Promise.props({
    internal: Users.getUser(username),
    meta: Users.getMetadata(username, audience)
  })
  .then(({ internal, meta }) => {
    const isAdmin = (meta[audience].roles || []).indexOf(USERS_ADMIN_ROLE) >= 0;
    if (isAdmin) {
      throw new Errors.HttpStatusError(400, 'can\'t remove admin user from the system');
    }

    return Users.removeUser(username, internal);
  });
};

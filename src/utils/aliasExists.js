const Errors = require('common-errors');
const { USERS_ALIAS_TO_LOGIN } = require('../constants.js');

function resolveAlias(alias) {
  return this.redis
    .hget(USERS_ALIAS_TO_LOGIN, alias)
    .then(username => {
      if (username) {
        throw new Errors.HttpStatusError(409, `"${alias}" already exists`);
      }

      return username;
    });
}

module.exports = function aliasExists(alias, thunk) {
  if (thunk) {
    return () => resolveAlias.call(this, alias);
  }

  return resolveAlias.call(this, alias);
};

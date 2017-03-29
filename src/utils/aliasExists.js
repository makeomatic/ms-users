const Errors = require('common-errors');
const { USERS_ALIAS_TO_ID } = require('../constants.js');

function resolveAlias(alias) {
  return this.redis
    .hget(USERS_ALIAS_TO_ID, alias)
    .then((userId) => {
      if (userId) {
        throw new Errors.HttpStatusError(409, `"${alias}" already exists`);
      }

      return userId;
    });
}

module.exports = function aliasExists(alias, thunk) {
  if (thunk) {
    return function resolveAliasThunk() {
      return resolveAlias.call(this, alias);
    };
  }

  return resolveAlias.call(this, alias);
};

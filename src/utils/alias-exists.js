const { HttpStatusError } = require('@microfleet/validation');
const { USERS_ALIAS_TO_ID } = require('../constants.js');

async function resolveAlias(alias) {
  const userId = await this.redis.hget(USERS_ALIAS_TO_ID, alias);

  if (userId) {
    const err = new HttpStatusError(409, `"${alias}" already exists`);
    err.code = 'E_ALIAS_CONFLICT';
    throw err;
  }

  return userId;
}

module.exports = resolveAlias;

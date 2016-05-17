const Promise = require('bluebird');
const Errors = require('common-errors');
const key = require('../utils/key');
const getInternalData = require('../utils/getInternalData');
const getMetadata = require('../utils/getMetadata');
const {
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_ALIAS_TO_LOGIN,
  USERS_DATA,
  USERS_METADATA,
  USERS_TOKENS,
  USERS_ALIAS_FIELD,
  USERS_ADMIN_ROLE,
} = require('../constants');

module.exports = function removeUser({ username }) {
  const audience = this.config.jwt.defaultAudience;

  return Promise.props({
    internal: getInternalData.call(this, username),
    meta: getMetadata.call(this, username, audience),
  })
  .then(({ internal, meta }) => {
    const isAdmin = (meta[audience].roles || []).indexOf(USERS_ADMIN_ROLE) >= 0;
    if (isAdmin) {
      throw new Errors.HttpStatusError(400, 'can\'t remove admin user from the system');
    }

    const transaction = this.redis.multi();
    const alias = internal[USERS_ALIAS_FIELD];
    if (alias) {
      transaction.hdel(USERS_ALIAS_TO_LOGIN, alias);
    }

    // clean indices
    transaction.srem(USERS_PUBLIC_INDEX, username);
    transaction.srem(USERS_INDEX, username);

    // remove metadata & internal data
    transaction.del(key(username, USERS_DATA));
    transaction.del(key(username, USERS_METADATA, audience));

    // remove auth tokens
    transaction.del(key(username, USERS_TOKENS));

    // complete it
    return transaction.exec();
  });
};

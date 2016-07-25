const { ActionTransport } = require('mservice');
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
  MAIL_ACTIVATE,
  MAIL_RESET,
  MAIL_PASSWORD,
  MAIL_REGISTER,
  THROTTLE_PREFIX,
} = require('../constants');

/**
 * @api {amqp} <prefix>.remove Remove User
 * @apiVersion 1.0.0
 * @apiName RemoveUser
 * @apiGroup Users
 *
 * @apiDescription Removes user from system. Be careful as this operation is not revertable.
 *
 * @apiParam (Payload) {String} username - currently only email is supported
 */
function removeUser(request) {
  const { username } = request.params;
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

    // remove throttling on actions
    transaction.del(key(THROTTLE_PREFIX, MAIL_ACTIVATE, username));
    transaction.del(key(THROTTLE_PREFIX, MAIL_PASSWORD, username));
    transaction.del(key(THROTTLE_PREFIX, MAIL_REGISTER, username));
    transaction.del(key(THROTTLE_PREFIX, MAIL_RESET, username));

    // complete it
    return transaction.exec();
  });
}

removeUser.schema = 'remove';

removeUser.transports = [ActionTransport.amqp];

module.exports = removeUser;

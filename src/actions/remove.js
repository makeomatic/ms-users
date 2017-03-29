const Promise = require('bluebird');
const Errors = require('common-errors');
const intersection = require('lodash/intersection');
const key = require('../utils/key');
const getInternalData = require('../utils/getInternalData');
const getMetadata = require('../utils/getMetadata');
const handlePipeline = require('../utils/pipelineError.js');
const {
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_ALIAS_TO_ID,
  USERS_DATA,
  USERS_METADATA,
  USERS_TOKENS,
  USERS_ID_FIELD,
  USERS_ALIAS_FIELD,
  USERS_ADMIN_ROLE,
  USERS_SUPER_ADMIN_ROLE,
  USERS_ACTION_ACTIVATE,
  USERS_ACTION_RESET,
  USERS_ACTION_PASSWORD,
  USERS_ACTION_REGISTER,
  THROTTLE_PREFIX,
} = require('../constants');

// intersection of priority users
const ADMINS = [USERS_ADMIN_ROLE, USERS_SUPER_ADMIN_ROLE];

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

  return Promise
    .props({
      // returns Buffers
      internal: getInternalData.call(this, username),
      // returns meta
      meta: getMetadata.call(this, username, audience),
    })
    .then(({ internal, meta }) => {
      const roles = (meta[audience].roles || []);

      if (intersection(roles, ADMINS).length > 0) {
        throw new Errors.HttpStatusError(400, 'can\'t remove admin user from the system');
      }

      const transaction = this.redis.multi();
      const alias = internal[USERS_ALIAS_FIELD];
      const userId = internal[USERS_ID_FIELD];

      if (alias) {
        transaction.hdel(USERS_ALIAS_TO_ID, alias.toLowerCase(), alias);
      }

      // clean indices
      transaction.srem(USERS_PUBLIC_INDEX, userId);
      transaction.srem(USERS_INDEX, userId);

      // remove metadata & internal data
      transaction.del(key(userId, USERS_DATA));
      transaction.del(key(userId, USERS_METADATA, audience));

      // remove auth tokens
      transaction.del(key(userId, USERS_TOKENS));

      // remove throttling on actions
      transaction.del(key(THROTTLE_PREFIX, USERS_ACTION_ACTIVATE, userId));
      transaction.del(key(THROTTLE_PREFIX, USERS_ACTION_PASSWORD, userId));
      transaction.del(key(THROTTLE_PREFIX, USERS_ACTION_REGISTER, userId));
      transaction.del(key(THROTTLE_PREFIX, USERS_ACTION_RESET, userId));

      // complete it
      return transaction
        .exec()
        .then(handlePipeline);
    });
}

module.exports = removeUser;

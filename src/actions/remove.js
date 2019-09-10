const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const Errors = require('common-errors');
const intersection = require('lodash/intersection');
const get = require('../utils/get-value');
const key = require('../utils/key');
const { getInternalData } = require('../utils/userData');
const getMetadata = require('../utils/getMetadata');
const handlePipeline = require('../utils/pipelineError');
const {
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_ALIAS_TO_ID,
  USERS_SSO_TO_ID,
  USERS_USERNAME_TO_ID,
  USERS_USERNAME_FIELD,
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
  SSO_PROVIDERS,
} = require('../constants');

// intersection of priority users
const ADMINS = [USERS_ADMIN_ROLE, USERS_SUPER_ADMIN_ROLE];

function addMetadata(userData) {
  const { audience } = this;
  const userId = userData[USERS_ID_FIELD];

  return Promise
    .bind(this, [userId, audience])
    .spread(getMetadata)
    .then((metadata) => [userData, metadata]);
}

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
async function removeUser({ params }) {
  const audience = this.config.jwt.defaultAudience;
  const { redis } = this;
  const context = { redis, audience };
  const { username } = params;

  const [internal, meta] = await Promise
    .bind(context, username)
    .then(getInternalData)
    .then(addMetadata);

  const roles = (meta[audience].roles || []);
  if (intersection(roles, ADMINS).length > 0) {
    throw new Errors.HttpStatusError(400, 'can\'t remove admin user from the system');
  }

  const transaction = redis.pipeline();
  const alias = internal[USERS_ALIAS_FIELD];
  const userId = internal[USERS_ID_FIELD];
  const resolvedUsername = internal[USERS_USERNAME_FIELD];

  if (alias) {
    transaction.hdel(USERS_ALIAS_TO_ID, alias.toLowerCase(), alias);
  }

  transaction.hdel(USERS_USERNAME_TO_ID, resolvedUsername);

  // remove refs to SSO account
  for (const provider of SSO_PROVIDERS) {
    const uid = get(internal, `${provider}.uid`, { default: false });

    if (uid) {
      transaction.hdel(USERS_SSO_TO_ID, uid);
    }
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
}

removeUser.transports = [ActionTransport.amqp];

module.exports = removeUser;

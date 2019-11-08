const { ActionTransport } = require('@microfleet/core');
const Promise = require('bluebird');
const Errors = require('common-errors');
const intersection = require('lodash/intersection');
const { getInternalData } = require('../utils/userData');
const getMetadata = require('../utils/get-metadata');
const User = require('../utils/user/user');
const InactiveUser = require('../utils/inactive-user/inactive-user');
const {
  USERS_ID_FIELD,
  USERS_ADMIN_ROLE,
  USERS_SUPER_ADMIN_ROLE,
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

  const user = new User(this);
  const inactiveUser = new InactiveUser(this);

  await inactiveUser.delete(internal.id);
  const removeResult = await user.delete(internal);
  await user.flushCaches();

  return removeResult;
}

removeUser.transports = [ActionTransport.amqp];

module.exports = removeUser;

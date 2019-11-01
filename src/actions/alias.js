const Promise = require('bluebird');
const Errors = require('common-errors');
const { ActionTransport } = require('@microfleet/core');
const { getInternalData } = require('../utils/userData');
const isActive = require('../utils/is-active');
const isBanned = require('../utils/is-banned');
const key = require('../utils/key');
const handlePipeline = require('../utils/pipeline-error');
const UserMetadata = require('../utils/metadata/user');

const {
  USERS_DATA,
  USERS_ALIAS_TO_ID,
  USERS_ID_FIELD,
  USERS_ALIAS_FIELD,
  USERS_PUBLIC_INDEX,
  lockAlias,
} = require('../constants');

/**
 * @api {amqp} <prefix>.alias Add alias to user
 * @apiVersion 1.0.0
 * @apiName AddAlias
 * @apiGroup Users
 *
 * @apiDescription Adds alias to existing username. This alias must be unique across system, as
 * well as obide strict restrictions - ascii chars only, include numbers and dot. It's used to obfuscate
 * username in public interfaces
 *
 * @apiParam (Payload) {String} username - currently email of the user
 * @apiParam (Payload) {String{3..15}} alias - chosen alias
 *
 */
async function assignAlias({ params }) {
  const { redis, config: { jwt: { defaultAudience } } } = this;
  const { username, internal } = params;

  // lowercase alias
  const alias = params.alias.toLowerCase();

  const data = await Promise
    .bind(this, username)
    .then(getInternalData)
    .tap(isBanned);

  if (data[USERS_ALIAS_FIELD]) {
    return Promise.reject(new Errors.HttpStatusError(417, 'alias is already assigned'));
  }

  // determine if user is active
  const userId = data[USERS_ID_FIELD];
  const activeUser = isActive(data, true);

  if (!activeUser && !internal) {
    return Promise.reject(new Errors.HttpStatusError(412, 'Account hasn\'t been activated'));
  }

  let lock;
  if (!internal) {
    // if we can't claim lock - must fail
    lock = await this.dlock.once(lockAlias(alias));
  }

  try {
    const assigned = await redis.hsetnx(USERS_ALIAS_TO_ID, alias, userId);

    if (assigned === 0) {
      const err = new Errors.HttpStatusError(409, `"${alias}" already exists`);
      err.code = 'E_ALIAS_CONFLICT';
      return Promise.reject(err);
    }

    const pipeline = redis.pipeline();

    pipeline.hset(key(userId, USERS_DATA), USERS_ALIAS_FIELD, alias);
    UserMetadata
      .for(userId, defaultAudience, pipeline)
      .update(USERS_ALIAS_FIELD, JSON.stringify(alias));

    if (activeUser) {
      pipeline.sadd(USERS_PUBLIC_INDEX, username);
    }

    return pipeline.exec().then(handlePipeline);
  } finally {
    // release lock, but do not wait for it to return result
    if (lock !== undefined) lock.release().reflect();
  }
}

assignAlias.transports = [ActionTransport.amqp, ActionTransport.internal];

module.exports = assignAlias;

const { ActionTransport } = require('@microfleet/core');
const { HttpStatusError } = require('common-errors');
const Promise = require('bluebird');
const redisKey = require('../utils/key.js');
const jwt = require('../utils/jwt.js');
const { getInternalData } = require('../utils/userData');
const getMetadata = require('../utils/get-metadata');
const handlePipeline = require('../utils/pipeline-error');
const setMetadata = require('../utils/update-metadata');
const {
  USERS_INDEX,
  USERS_DATA,
  USERS_REFERRAL_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_ACTIVE_FLAG,
  USERS_ID_FIELD,
  USERS_ALIAS_FIELD,
  USERS_REFERRAL_FIELD,
  USERS_ACTIVATED_FIELD,
} = require('../constants.js');

/**
 * Helper to determine if something is true
 */
function throwBasedOnStatus(status) {
  if (status === 'true') {
    return true;
  }

  return false;
}

/**
 * Verifies that account is active
 */
function isAccountActive(username) {
  return getInternalData
    .call(this, username)
    .then((userData) => userData[USERS_ACTIVE_FLAG])
    .then(throwBasedOnStatus);
}

/**
 * Deactivates account after it was verified
 * @param  {Object} data internal user data
 * @return {Promise}
 */
async function deactivateAccount(data, metadata) {
  const userId = data[USERS_ID_FIELD];
  const alias = data[USERS_ALIAS_FIELD];
  const referral = metadata[USERS_REFERRAL_FIELD];
  const userKey = redisKey(userId, USERS_DATA);
  const { defaultAudience, service } = this;
  const { redis } = service;

  // if this goes through, but other async calls fail its ok to repeat that
  // adds activation field
  await setMetadata.call(service, {
    userId,
    audience: defaultAudience,
    metadata: {
      $set: {
        [USERS_ACTIVATED_FIELD]: null,
      },
    },
  });

  // WARNING: `persist` is very important, otherwise we will lose user's information in 30 days
  // set to active & persist
  const pipeline = redis
    .pipeline()
    .hset(userKey, USERS_ACTIVE_FLAG, 'false')
    .persist(userKey)
    .sadd(USERS_INDEX, userId);

  if (alias) {
    pipeline.sadd(USERS_PUBLIC_INDEX, userId);
  }

  if (referral) {
    pipeline.sadd(`${USERS_REFERRAL_INDEX}:${referral}`, userId);
  }

  handlePipeline(await pipeline.exec());

  return userId;
}

/**
 * @api {amqp} <prefix>.deactivate Deactivate User
 * @apiVersion 1.0.0
 * @apiName DeactivateUser
 * @apiGroup Users
 *
 * @apiDescription This method allows one to deactivate user
 * No verifications will be performed and user will be set
 *    to inactive. This case is used when admin deactivates a user.
 * Success response contains user object.
 *
 * @apiParam (Payload) {String} username - id of the user
 * @apiParam (Payload) {String} [audience] - additional metadata will be pushed there from custom hooks
 *
 */
async function deactivateAction({ params }) {
  const { username } = params;
  const { config } = this;
  const { jwt: { defaultAudience } } = config;
  const audience = params.audience || defaultAudience;

  // basic context
  const context = {
    audience,
    defaultAudience,
    username,
    service: this,
    erase: config.token.erase,
  };

  const isActive = await isAccountActive.call(this, username);

  if (!isActive) {
    throw new HttpStatusError(417, `Account ${username} was already deactivated`);
  }

  const userId = await Promise
    .bind(context)
    .then(() => getInternalData.call(this, username))
    .then((internalData) => Promise.join(
      internalData,
      getMetadata.call(this, internalData[USERS_ID_FIELD], audience).get(audience)
    ))
    .spread(deactivateAccount);

  return jwt.reset.call(this, userId);
}

deactivateAction.transports = [ActionTransport.amqp];

module.exports = deactivateAction;

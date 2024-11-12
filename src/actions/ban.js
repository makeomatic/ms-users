const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const { ActionTransport } = require('@microfleet/plugin-router');

const redisKey = require('../utils/key');
const { getInternalData } = require('../utils/user-data');
const handlePipeline = require('../utils/pipeline-error');
const {
  USERS_DATA, USERS_METADATA,
  USERS_BANNED_FLAG, USERS_TOKENS, USERS_BANNED_DATA,
} = require('../constants');

// helper
const stringify = (data) => JSON.stringify(data);

function lockUser({
  id, reason, whom, remoteip,
}) {
  const { redis, config } = this;
  const { jwt: { defaultAudience } } = config;
  const data = {
    banned: true,
    [USERS_BANNED_DATA]: {
      reason: reason || '',
      whom: whom || '',
      remoteip: remoteip || '',
    },
  };

  return redis
    .pipeline()
    .hset(redisKey(id, USERS_DATA), USERS_BANNED_FLAG, 'true')
    // set .banned on metadata for filtering & sorting users by that field
    .hmset(redisKey(id, USERS_METADATA, defaultAudience), mapValues(data, stringify))
    .del(redisKey(id, USERS_TOKENS))
    .exec();
}

function unlockUser({ id }) {
  const { redis, config } = this;
  const { jwt: { defaultAudience } } = config;

  return redis
    .pipeline()
    .hdel(redisKey(id, USERS_DATA), USERS_BANNED_FLAG)
    // remove .banned on metadata for filtering & sorting users by that field
    .hdel(redisKey(id, USERS_METADATA, defaultAudience), 'banned', USERS_BANNED_DATA)
    .exec();
}

/**
 * @api {amqp} <prefix>.ban Lock or Unlock user
 * @apiVersion 1.0.0
 * @apiName BanUser
 * @apiGroup Users
 *
 * @apiDescription Allows one to lock or unlock a given user, optionally supplying reason for
 * why the user was banned.
 *
 * @apiParam (Payload) {String} username - currently email of the user
 * @apiParam (Payload) {Boolean="true","false"} ban - if `true`, then user is going to be banned, if `false` - unlocked
 * @apiParam (Payload) {String} [remoteip] - used for security log
 * @apiParam (Payload) {String} [reason] - reason for the user being banned
 * @apiParam (Payload) {String} [whom] - id of the person, who banned the user
 *
 */
module.exports = function banUser(request) {
  return Promise
    .bind(this, request.params.username)
    .then(getInternalData)
    .then(({ id }) => ({ ...request.params, id }))
    .then(request.params.ban ? lockUser : unlockUser)
    .then(handlePipeline);
};

module.exports.transports = [ActionTransport.amqp, ActionTransport.internal];

const Promise = require('bluebird');
const mapValues = require('lodash/mapValues');
const redisKey = require('../utils/key.js');
const userExists = require('../utils/userExists.js');
const {
  USERS_DATA, USERS_METADATA,
  USERS_BANNED_FLAG, USERS_TOKENS, USERS_BANNED_DATA,
} = require('../constants.js');

const stringify = JSON.stringify.bind(JSON);

function lockUser({ username, reason, whom, remoteip }) {
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
    .hset(redisKey(username, USERS_DATA), USERS_BANNED_FLAG, 'true')
    // set .banned on metadata for filtering & sorting users by that field
    .hmset(redisKey(username, USERS_METADATA, defaultAudience), mapValues(data, stringify))
    .del(redisKey(username, USERS_TOKENS))
    .exec();
}

function unlockUser({ username }) {
  const { redis, config } = this;
  const { jwt: { defaultAudience } } = config;

  return redis
    .pipeline()
    .hdel(redisKey(username, USERS_DATA), USERS_BANNED_FLAG)
    // remove .banned on metadata for filtering & sorting users by that field
    .hdel(redisKey(username, USERS_METADATA, defaultAudience), 'banned', USERS_BANNED_DATA)
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
module.exports = function banUser(opts) {
  return Promise
    .bind(this, opts.username)
    .then(userExists)
    .then(username => ({ ...opts, username }))
    .then(opts.ban ? lockUser : unlockUser);
};

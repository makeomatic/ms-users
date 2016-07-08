const Promise = require('bluebird');
const { User } = require('../model/usermodel');

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
    .then(User.getUsername)
    .then(username => ({ ...opts, username }))
    .then(opts.ban ? User.lock : User.unlock);
};

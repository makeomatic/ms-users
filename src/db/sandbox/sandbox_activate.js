/**
 * Created by Stainwoortsel on 30.05.2016.
 */
const Promise = require('bluebird');
const emailVerification = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const Adapter = require('./redisadapter');

module.exports = function verifyChallenge(opts) {
  // TODO: add security logs
  // var remoteip = opts.remoteip;
  const { token, namespace, username } = opts;
  const { redis, config } = this;
  const audience = opts.audience || config.defaultAudience;

  const users = new Adapter();

  function verifyToken() {
    return emailVerification.verify.call(this, token, namespace, config.validation.ttl > 0);
  }

  function hook(user) {
    return this.hook.call(this, 'users:activate', user, audience);
  }

  return Promise
    .bind(this, username)
    .then(username ? users.userExists : verifyToken)
    .tap(users.activateAccount)
    .tap(hook)
    .then(user => [user, audience])
    .spread(jwt.login);
};

'use strict';

const Promise = require('bluebird');
const emailVerification = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const Users = require('../db/adapter');

module.exports = function verifyChallenge(opts) {
  // TODO: add security logs
  // var remoteip = opts.remoteip;
  const { token, namespace, username } = opts;
  const { config } = this;
  const audience = opts.audience || config.defaultAudience;

  function verifyToken() {
    return emailVerification.verify.call(this, token, namespace, config.validation.ttl > 0);
  }

  function hook(user) {
    return this.hook.call(this, 'users:activate', user, audience);
  }

  return Promise.bind(this, username).then(username ? Users.isExists : verifyToken).tap(Users.activateAccount).tap(hook).then(user => [user, audience]).spread(jwt.login);
};

//# sourceMappingURL=activate-compiled.js.map
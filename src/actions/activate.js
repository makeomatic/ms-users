const Promise = require('bluebird');
const emailVerification = require('../utils/send-email.js');
const jwt = require('../utils/jwt.js');
const { User } = require('../model/usermodel');
const { ModelError } = require('../model/modelError');

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

  return Promise
    .bind(this, username)
    .then(username ? User.getUsername : verifyToken)
    .tap(User.activate)
    .tap(hook)
    .then(user => [user, audience])
    .spread(jwt.login)
    .catch(e => { throw (e instanceof ModelError ? e : e.mapToHttp); });
};

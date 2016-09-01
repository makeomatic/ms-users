const Promise = require('bluebird');
const defaults = require('lodash/defaults');
const register = require('../actions/register.js');
const { USERS_ADMIN_ROLE, CHALLENGE_TYPE_EMAIL } = require('../constants.js');

module.exports = function initAccounts() {
  const config = this.config;
  const accounts = config.admins;
  const audience = config.jwt.defaultAudience;

  return Promise
    .delay(config.initAdminAccountsDelay)
    .return(accounts)
    // @todo use router dispatch, because a schema can contains default params
    .map(account => register
      .call(this, {
        params: {
          audience,
          username: account.username,
          password: account.password,
          metadata: defaults(account.metadata || {}, {
            firstName: account.firstName,
            lastName: account.lastName,
            roles: [USERS_ADMIN_ROLE],
          }),
          activate: true,
          challengeType: CHALLENGE_TYPE_EMAIL,
          skipPassword: false,
        },
      })
      .reflect()
    )
    .bind(this)
    .then(function reportStats(users) {
      const totalAccounts = users.length;
      const errors = [];
      let registered = 0;
      users.forEach(user => {
        if (user.isFulfilled()) {
          registered++;
        } else {
          errors.push(user.reason());
        }
      });

      this.log.info(
        'Registered admins %d/%d. Errors: %d',
        registered, totalAccounts, errors.length
      );

      errors.forEach(err => {
        if (err.statusCode !== 403) {
          this.log.warn(err.stack);
        }
      });

      return null;
    })
    .finally(() => {
      this.log.info('removing account references from memory');
      config.admins = [];
    });
};

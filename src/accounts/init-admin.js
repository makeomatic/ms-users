const Promise = require('bluebird');
const defaults = require('lodash/defaults');
const register = require('../actions/register');
const uuid = require('uuid');
const saveReferral = require('../actions/referral');
const { USERS_ADMIN_ROLE, CHALLENGE_TYPE_EMAIL } = require('../constants');

module.exports = function initAccounts() {
  const { config } = this;
  const accounts = config.admins;
  const audience = config.jwt.defaultAudience;

  return Promise
    .delay(config.initAdminAccountsDelay)
    .return(accounts)
    // @todo use router dispatch, because a schema can contains default params
    .map((account) => {
      const userData = {
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
      };

      if (account.alias) {
        userData.alias = account.alias;
      }

      if (!account.referral) {
        return { params: userData };
      }

      userData.referral = uuid.v4();

      // this will be performed each time on startup, but shouldnt be a problem due to NX
      // and lack of side-effect
      return saveReferral
        .call(this, {
          params: {
            id: userData.referral,
            referral: account.referral,
          },
        })
        .return({ params: userData });
    })
    .map(userData => Promise.bind(this, userData).then(register).reflect())
    .then((users) => {
      const totalAccounts = users.length;
      const errors = [];
      let registered = 0;
      users.forEach((user) => {
        if (user.isFulfilled()) {
          registered += 1;
        } else {
          errors.push(user.reason());
        }
      });

      this.log.info(
        'Registered admins %d/%d. Errors: %d',
        registered, totalAccounts, errors.length
      );

      errors.forEach((err) => {
        if (err.statusCode !== 403 && err.statusCode !== 409) {
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

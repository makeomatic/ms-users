const Promise = require('bluebird');
const times = require('lodash/times');
const register = require('../actions/register.js');
const { CHALLENGE_TYPE_EMAIL } = require('../constants.js');

module.exports = function initFakeAccounts() {
  const faker = require('faker');

  const config = this.config;
  const accounts = times(103, () => ({
    id: faker.internet.email(),
    metadata: {
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
    },
    activate: true,
  }));

  const audience = config.jwt.defaultAudience;

  return Promise
    .map(accounts, account => register
      .call(this, {
        params: {
          username: account.id,
          password: (Math.random() * 20).toFixed(20),
          audience,
          metadata: {
            firstName: account.metadata.firstName,
            lastName: account.metadata.lastName,
          },
          activate: true,
          challengeType: CHALLENGE_TYPE_EMAIL,
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
        'Registered fake users %d/%d. Errors: %d',
        registered, totalAccounts, errors.length
      );

      errors.forEach(err => {
        if (err.statusCode !== 403) {
          this.log.warn(err.stack);
        }
      });

      return null;
    });
};

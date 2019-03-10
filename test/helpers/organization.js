const Promise = require('bluebird');
const faker = require('faker');
const times = require('lodash/times');
const { inspectPromise } = require('@makeomatic/deploy');

exports.registerMembers = async function (totalUsers = 1) {
  const promises = [];
  const audience = '*.localhost';

  times(totalUsers, () => {
    const userOpts = {
      username: faker.internet.email(),
      password: '123',
      audience,
      metadata: {
        username: faker.internet.email(),
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      },
    };

    promises.push(this.dispatch('users.register', userOpts).then(({ user }) => user));
  });

  this.userStubs = await Promise.all(promises);
  this.userStubs = this.userStubs.map(user => ({
    ...user,
    metadata: user.metadata[audience],
  }));
  this.userIds = this.userStubs.map(({ id }) => ({ id }));
  this.userNames = this.userStubs.map(({ metadata: { username } }) => ({ username }));
  return this.userStubs;
};

exports.createOrganization = async function (customOpts = {}, totalUsers = 1) {
  const opts = {
    name: faker.company.companyName(),
    metadata: {
      description: 'Test description',
      address: faker.address.streetAddress(),
    },
    members: this.userNames ? this.userNames.slice(0, totalUsers) : undefined,
    ...customOpts,
  };
  this.organization = await this.dispatch('users.organization.create', opts).reflect().then(inspectPromise(true));
  return this.organization;
};

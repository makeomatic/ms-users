const faker = require('faker');
const times = require('lodash/times');
const { inspectPromise } = require('@makeomatic/deploy');

exports.createMembers = async function (totalUsers = 1) {
  this.userNames = [];

  times(totalUsers, () => {
    this.userNames.push({
      email: faker.internet.email(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
    });
  });
};

exports.createOrganization = async function (customOpts = {}, totalUsers = 1) {
  const opts = {
    name: faker.company.companyName(),
    metadata: {
      description: 'Test description',
      address: faker.address.streetAddress(),
    },
    members: this.userNames.slice(0, totalUsers),
    ...customOpts,
  };
  this.organization = await this.dispatch('users.organization.create', opts).reflect().then(inspectPromise(true));
  return this.organization;
};

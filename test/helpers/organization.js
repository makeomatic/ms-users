const faker = require('faker');
const times = require('lodash/times');
const { inspectPromise } = require('@makeomatic/deploy');

async function createMembers(totalUsers = 1) {
  this.userNames = [];

  times(totalUsers, () => {
    this.userNames.push({
      email: faker.internet.email(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
    });
  });
}

exports.createMembers = createMembers;

exports.createOrganization = async function (customOpts = {}, totalUsers = 1) {
  if (!this.userNames) {
    await createMembers.call(this, totalUsers);
  }

  const params = {
    name: faker.company.companyName(),
    metadata: {
      description: 'Test description',
      address: faker.address.streetAddress(),
    },
    members: this.userNames.slice(0, totalUsers),
    ...customOpts,
  };
  const organization = await this.dispatch('users.organization.create', params)
    .reflect()
    .then(inspectPromise(true));

  this.organization = {
    ...organization.data.attributes,
    ...organization.meta,
  };
  return this.organization;
};

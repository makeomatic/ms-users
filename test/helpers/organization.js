const Promise = require('bluebird');
const faker = require('faker');
const times = require('lodash/times');
const { inspectPromise } = require('@makeomatic/deploy');
const jwt = require('../../src/utils/jwt');

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
  await this.users.dispatch('register', {
    params: {
      username: 'v@makeomatic.ru',
      password: '123456',
      audience: 'test',
      metadata: {
        fine: true,
      },
    },
  });

  const [bearer] = await Promise.all([
    this.users.dispatch('token.create', {
      params: {
        username: 'v@makeomatic.ru',
        name: 'sample',
      },
    }),
    jwt.login.call(this.users, 'v@makeomatic.ru', 'test'),
  ]);

  this.bearerAuthHeaders = { authorization: `Bearer ${bearer}` };

  const params = {
    name: faker.company.companyName(),
    metadata: {
      description: 'Test description',
      address: faker.address.streetAddress(),
    },
    members: this.userNames.slice(0, totalUsers),
    ...customOpts,
  };
  this.organization = await this.users
    .dispatch('organization.create', { params, headers: this.bearerAuthHeaders })
    .reflect()
    .then(inspectPromise(true));
  return this.organization;
};

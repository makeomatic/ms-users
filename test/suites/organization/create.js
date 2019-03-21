/* eslint-disable promise/always-return, no-prototype-builtins */
const Promise = require('bluebird');
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const { createMembers } = require('../../helpers/organization');
const jwt = require('../../../src/utils/jwt');

describe('#create organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createMembers.call(this, 2); });
  beforeEach(async function pretest() {
    await this.users.dispatch('register', {
      params: {
        username: 'v@makeomatic.ru',
        password: '123',
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
  });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.create', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 1);
      });
  });

  it('must be able to create organization', function test() {
    const opts = {
      name: faker.company.companyName(),
      metadata: {
        description: 'test organization',
      },
      members: this.userNames.slice(0, 2),
    };

    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.name === opts.name);
        assert(createdOrganization.metadata.description === opts.metadata.description);
        assert(createdOrganization.members.length === 2);
        assert.ok(createdOrganization.id);
        assert.ok(createdOrganization.active);
      });
  });

  it('must return organization exists error', async function test() {
    const opts = {
      name: faker.company.companyName(),
    };

    await this.dispatch('users.organization.create', opts).reflect();
    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});

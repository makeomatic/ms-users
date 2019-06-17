/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const sinon = require('sinon');
const faker = require('faker');
const { createMembers, createOrganization } = require('../../helpers/organization');
const scrypt = require('../../../src/utils/scrypt');
const registerOrganizationMembers = require('../../../src/utils/organization/registerOrganizationMembers');

describe('#create organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createMembers.call(this, 1); });
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

  it('must be able to create organization and register user', async function test() {
    const sendInviteMailSpy = sinon.spy(registerOrganizationMembers, 'call');
    const generatePasswordSpy = sinon.spy(scrypt, 'hash');

    const params = {
      name: faker.company.companyName(),
      metadata: {
        description: 'test organization',
      },
      members: this.userNames.slice(0, 2),
    };

    await this.dispatch('users.organization.create', params)
      .reflect()
      .then(inspectPromise(true))
      .then((response) => {
        const createdOrganization = response.data.attributes;
        assert(createdOrganization.name === params.name);
        assert(createdOrganization.metadata.description === params.metadata.description);
        assert(createdOrganization.members.length === 1);
        assert.ok(createdOrganization.id);
        assert(createdOrganization.active === false);
      });

    const [registeredMember] = await sendInviteMailSpy.returnValues[0];
    const registeredMemberPassword = generatePasswordSpy.firstCall.args[0];
    const loginParams = {
      username: registeredMember.email,
      password: registeredMemberPassword,
      audience: '*.localhost',
    };

    return this.users.dispatch('login', { params: loginParams })
      .reflect()
      .then(inspectPromise());
  });

  it('must return organization exists error', async function test() {
    await createOrganization.call(this, {}, 2);
    const params = {
      name: this.organization.name,
    };

    return this.dispatch('users.organization.create', params)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});

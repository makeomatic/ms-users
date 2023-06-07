const { strict: assert } = require('assert');
const sinon = require('sinon');
const { faker } = require('@faker-js/faker');
const { startService, clearRedis } = require('../../../config');
const { createMembers, createOrganization } = require('../../../helpers/organization');
const scrypt = require('../../../../src/utils/scrypt');
const registerOrganizationMembers = require('../../../../src/utils/organization/register-organization-members');

describe('#create organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(startService);
  beforeEach(function pretest() {
    return createMembers.call(this, 1);
  });
  afterEach(clearRedis);

  it('must reject invalid organization params and return detailed error', async function test() {
    await assert.rejects(this.users.dispatch('organization.create', { params: {} }), (err) => {
      assert.equal(err.name, 'HttpStatusError');
      assert.equal(err.statusCode, 400);
      assert.equal(err.errors.length, 1);
      return true;
    });
  });

  it('must be able to create organization and register user', async function test() {
    const sendInviteMailSpy = sinon.spy(registerOrganizationMembers, 'call');
    const generatePasswordSpy = sinon.spy(scrypt, 'hash');

    const params = {
      name: faker.company.name(),
      metadata: {
        description: 'test organization',
      },
      members: this.userNames.slice(0, 1),
    };

    const response = await this.users.dispatch('organization.create', { params });

    const createdOrganization = response.data.attributes;
    assert(createdOrganization.name === params.name);
    assert(createdOrganization.metadata.description === params.metadata.description);
    assert(createdOrganization.members.length === 1);
    assert.ok(createdOrganization.id);
    assert(createdOrganization.active === false);

    const [registeredMember] = await sendInviteMailSpy.returnValues[0];
    const registeredMemberPassword = generatePasswordSpy.firstCall.args[0];
    const loginParams = {
      username: registeredMember.email,
      password: registeredMemberPassword,
      audience: '*.localhost',
    };

    const { user } = await this.users.dispatch('login', { params: loginParams });

    assert(/^\d+$/.test(user.metadata[loginParams.audience].aa), 'activation time is not present');
  });

  it('must return organization exists error', async function test() {
    await createOrganization.call(this, {}, 2);
    const params = {
      name: this.organization.name,
    };

    await assert.rejects(this.users.dispatch('organization.create', { params }), {
      name: 'HttpStatusError',
    });
  });
});

const { strict: assert } = require('assert');
const { faker } = require('@faker-js/faker');
const sinon = require('sinon');
const { createOrganization } = require('../../../helpers/organization');
const generateEmail = require('../../../../src/utils/challenges/email/generate');

describe('#invite organization', function registerSuite() {
  this.timeout(50000);

  before(global.startService);
  before(async function pretest() {
    this.admin = {
      email: faker.internet.email(),
      permissions: ['root'],
    };

    this.member = {
      email: faker.internet.email(),
      permissions: ['member'],
    };

    this.spy = sinon.spy(generateEmail, 'call');

    const org = await createOrganization.call(this);
    const [root] = org.members;
    this.rootAdmin = root;

    return org;
  });
  after(global.clearRedis);

  it('must be able to send invite to admin', async function test() {
    const opts = {
      organizationId: this.organization.id,
      senderId: this.rootAdmin.id,
      member: this.admin,
    };

    await this.users.dispatch('organization.invites.send', { params: opts });
    this.admin.token = this.spy.lastCall.args[3].token;
  });

  it('must be able to send invite to member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      senderId: this.rootAdmin.id,
      member: this.member,
    };

    await this.users.dispatch('organization.invites.send', { params: opts });
    this.member.token = this.spy.lastCall.args[3].token;
  });

  it('includes sender display name to the invitation email', async function test() {
    const opts = {
      organizationId: this.organization.id,
      senderId: this.rootAdmin.id,
      member: this.member,
    };
    await this.users.dispatch('organization.invites.send', { params: opts });
    const { firstName, lastName } = this.rootAdmin;
    const expectedName = `${firstName} ${lastName}`;
    assert.strictEqual(this.spy.lastCall.args[3].senderName, expectedName);
  });

  it('returns empty for unknown sender', async function test() {
    const opts = {
      organizationId: this.organization.id,
      senderId: 'unknown-sender-id',
      member: this.member,
    };
    await this.users.dispatch('organization.invites.send', { params: opts });
    assert.strictEqual(this.spy.lastCall.args[3].senderName, undefined);
  });

  it('must be able to resend invite to member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      senderId: this.rootAdmin.id,
      member: this.member,
    };
    await this.users.dispatch('organization.invites.send', { params: opts });
    this.member.token = this.spy.lastCall.args[3].token;
  });

  it('must be able to get invites list', async function test() {
    return this.users.dispatch('organization.invites.list', { params: { organizationId: this.organization.id } })
      .then(({ data }) => {
        // At this point we're expecting to have 3 users:
        // - root, created at a test case above
        // - member, also created at a test case
        assert.equal(data.length, 2);
        for (const invite of data) {
          assert(invite.id);
          assert(invite.type);
          assert(invite.attributes);
          assert(invite.attributes.id);
          assert(invite.attributes.created);
          assert(invite.attributes.metadata);
          assert(invite.attributes.metadata.permissions);
        }

        const admin = data.find(({ id }) => id === this.admin.email);
        const member = data.find(({ id }) => id === this.member.email);

        assert(admin);
        assert(member);
        assert.deepStrictEqual(admin.attributes.metadata.permissions, this.admin.permissions);
        assert.deepStrictEqual(member.attributes.metadata.permissions, this.member.permissions);
      });
  });

  it('must return error with wrong token', async function test() {
    const opts = {
      organizationId: this.organization.id,
      member: {
        ...this.member,
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      },
      inviteToken: this.admin.token.secret,
    };

    await assert.rejects(this.users.dispatch('organization.invites.accept', { params: opts }));
  });
  it('must return error when accept invite to member not contain required fields', async function test() {
    this.memberPassword = faker.internet.password();

    const opts = {
      organizationId: this.organization.id,
      member: {
        ...this.member,
        firstName: faker.name.firstName(),
      },
      password: this.memberPassword,
      inviteToken: this.member.token.secret,
    };

    await assert.rejects(this.users.dispatch('organization.invites.accept', { params: opts }));
  });
  it('must be able to accept invite to member', async function test() {
    this.memberPassword = faker.internet.password();

    const opts = {
      organizationId: this.organization.id,
      member: {
        ...this.member,
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      },
      password: this.memberPassword,
      inviteToken: this.member.token.secret,
    };

    await this.users.dispatch('organization.invites.accept', { params: opts });
  });

  it('must be able login invited user', async function test() {
    const opts = {
      username: this.member.email,
      password: this.memberPassword,
      audience: '*.localhost',
    };

    return this.users.dispatch('login', { params: opts });
  });

  it('must be able to get invites list without invited user', async function test() {
    return this.users.dispatch('organization.invites.list', { params: { organizationId: this.organization.id } })
      .then(({ data }) => {
        // At this point we're expecting to have 3 users:
        // - root, created at a test case above
        // - member, also created at a test case
        assert.equal(data.length, 1);
        for (const invite of data) {
          assert(invite.id);
          assert(invite.type);
          assert(invite.attributes);
          assert(invite.attributes.id);
          assert(invite.attributes.created);
          assert(invite.attributes.metadata);
          assert(invite.attributes.metadata.permissions);
        }

        const admin = data.find(({ id }) => id === this.admin.email);

        assert(admin);
        assert.deepStrictEqual(admin.attributes.metadata.permissions, this.admin.permissions);
      });
  });

  it('must be able to revoke invite to admin', async function test() {
    const opts = {
      organizationId: this.organization.id,
      member: {
        email: this.admin.email,
      },
    };

    await this.users.dispatch('organization.invites.revoke', { params: opts });
  });

  it('must return error on revoked token', async function test() {
    const opts = {
      organizationId: this.organization.id,
      member: {
        ...this.admin,
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      },
      inviteToken: this.admin.token.secret,
    };

    await assert.rejects(this.users.dispatch('organization.invites.accept', { params: opts }));
  });

  it('must be able to get invites list without revoked user', async function test() {
    return this.users.dispatch('organization.invites.list', { params: { organizationId: this.organization.id } })
      .then(({ data }) => {
        assert.equal(data.length, 0);
      });
  });

  it('must return error on expired token', async function test() {
    const opts = {
      organizationId: this.organization.id,
      member: {
        ...this.admin,
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      },
      inviteToken: this.admin.token.secret,
    };

    await assert.rejects(this.users.dispatch('organization.invites.accept', { params: opts }));
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
      senderId: this.rootAdmin.id,
      member: this.member,
    };

    await assert.rejects(this.users.dispatch('organization.invites.send', { params: opts }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });
});

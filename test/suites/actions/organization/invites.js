/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const faker = require('faker');
const sinon = require('sinon');
const { createOrganization } = require('../../../helpers/organization');
const generateEmail = require('../../../../src/utils/challenges/email/generate.js');

describe('#invite organization', function registerSuite() {
  this.timeout(50000);

  before(global.startService);
  before(function pretest() {
    this.admin = {
      email: faker.internet.email(),
      permissions: ['root'],
    };

    this.member = {
      email: faker.internet.email(),
      permissions: ['member'],
    };

    this.spy = sinon.spy(generateEmail, 'call');

    return createOrganization.call(this);
  });
  after(global.clearRedis);

  it('must be able to send invite to admin', async function test() {
    const opts = {
      organizationId: this.organization.id,
      member: this.admin,
    };
    await this.dispatch('users.organization.invites.send', opts);
    this.admin.token = this.spy.lastCall.args[3].token;
  });

  it('must be able to send invite to member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      member: this.member,
    };
    await this.dispatch('users.organization.invites.send', opts);
    this.member.token = this.spy.lastCall.args[3].token;
  });

  it('must be able to resend invite to member', async function test() {
    const opts = {
      organizationId: this.organization.id,
      member: this.member,
    };
    await this.dispatch('users.organization.invites.send', opts);
    this.member.token = this.spy.lastCall.args[3].token;
  });

  it('must be able to get invites list', async function test() {
    return this.dispatch('users.organization.invites.list', { organizationId: this.organization.id })
      .reflect()
      .then(inspectPromise())
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

    await this.dispatch('users.organization.invites.accept', opts)
      .reflect()
      .then(inspectPromise(false));
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

    await this.dispatch('users.organization.invites.accept', opts);
  });

  it('must be able login invited user', async function test() {
    const opts = {
      username: this.member.email,
      password: this.memberPassword,
      audience: '*.localhost',
    };

    return this.dispatch('users.login', opts)
      .reflect()
      .then(inspectPromise());
  });

  it('must be able to get invites list without invited user', async function test() {
    return this.dispatch('users.organization.invites.list', { organizationId: this.organization.id })
      .reflect()
      .then(inspectPromise())
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

    await this.dispatch('users.organization.invites.revoke', opts);
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

    await this.dispatch('users.organization.invites.accept', opts)
      .reflect()
      .then(inspectPromise(false));
  });

  it('must be able to get invites list without revoked user', async function test() {
    return this.dispatch('users.organization.invites.list', { organizationId: this.organization.id })
      .reflect()
      .then(inspectPromise())
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

    await this.dispatch('users.organization.invites.accept', opts)
      .reflect()
      .then(inspectPromise(false));
  });

  it('must return organization not found error', async function test() {
    const opts = {
      organizationId: faker.company.companyName(),
      member: this.member,
    };

    return this.dispatch('users.organization.invites.send', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});

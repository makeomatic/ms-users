/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#send invite organization', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() {
    return this
      .dispatch('users.register', {
        username: 'organizationMember1@makeomatic.ru', password: '123', audience: '*.localhost', metadata: { name: 'member1' },
      })
      .then(({ user }) => {
        this.userId1 = user.id;
      });
  });
  afterEach(global.clearRedis);

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.invites.send', {})
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
        assert.equal(response.errors.length, 2);
      });
  });

  it('must be able to add member to organization', async function test() {
    const opts = {
      name: 'Pied Piper',
    };
    const member = {
      username: 'organizationMember1@makeomatic.ru',
    };

    await this.dispatch('users.organization.create', opts).reflect();
    return this.dispatch('users.organization.invites.send', { ...opts, ...member })
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.name === opts.name);
        assert(createdOrganization.members[0].id === member.username);
      });
  });

  it('must return organization not found error', async function test() {
    const opts = {
      name: 'Pied Piper',
    };

    return this.dispatch('users.organization.invites.send', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});

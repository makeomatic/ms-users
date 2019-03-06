/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#create organization', function registerSuite() {
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
  beforeEach(function pretest() {
    return this
      .dispatch('users.register', {
        username: 'organizationMember2@makeomatic.ru', password: '123', audience: '*.localhost', metadata: { name: 'member2' },
      })
      .then(({ user }) => {
        this.userId2 = user.id;
      });
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
      name: 'Pied Piper',
      metadata: {
        description: 'test organization',
      },
      members: [
        { id: this.userId1 },
        { id: this.userId2 },
      ],
    };

    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert(createdOrganization.name === opts.name);
        assert(createdOrganization.metadata.description === opts.metadata.description);
        assert.deepEqual(createdOrganization.members, opts.members);
        assert.ok(createdOrganization.id);
        assert.ok(createdOrganization.active);
      });
  });

  it('must return organization exists error', async function test() {
    const opts = {
      name: 'Pied Piper',
    };

    await this.dispatch('users.organization.create', opts).reflect();
    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(true))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });

  it('must return member not found error', async function test() {
    const opts = {
      name: 'Pied Piper',
      members: [
        { id: this.userId1 },
        { id: 'sdfasdf323' },
      ],
    };

    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        assert.equal(response.name, 'HttpStatusError');
      });
  });
});

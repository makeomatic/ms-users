const Promise = require('bluebird');
const { strict: assert } = require('assert');
const { expect } = require('chai');
const times = require('lodash/times');
const { createOrganization } = require('../../../helpers/organization');

describe('#organizations list', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function pretest() { return createOrganization.call(this); });
  afterEach(global.clearRedis);

  it('must be able to return organization lists', async function test() {
    const opts = {
      limit: 5,
      offset: 1,
    };
    const jobs = [];
    const organizationsLength = 20;

    times(organizationsLength - 1, () => {
      jobs.push(createOrganization.call(this));
    });

    await Promise.all(jobs);

    return this.users.dispatch('organization.list', { params: opts })
      .then(({ data, meta }) => {
        assert.equal(meta.total, organizationsLength);
        assert.equal(meta.cursor, opts.limit + opts.offset);
        assert.equal(meta.page, 1);
        assert.equal(meta.pages, organizationsLength / opts.limit);
        data.forEach((organization) => {
          expect(organization).to.have.ownProperty('id');
          expect(organization).to.have.ownProperty('type');
          expect(organization.attributes).to.have.ownProperty('id');
          expect(organization.attributes).to.have.ownProperty('name');
          expect(organization.attributes).to.have.ownProperty('active');
          expect(organization.attributes).to.have.ownProperty('metadata');
        });
      });
  });

  it('must be able to return organizations by filter ', async function test() {
    const opts = {
      limit: 1,
      filter: {
        name: this.organization.name,
      },
    };
    const jobs = [];
    const organizationsLength = 20;
    const { members, invites, ...organization } = this.organization;

    times(organizationsLength - 1, () => {
      jobs.push(createOrganization.call(this));
    });

    await Promise.all(jobs);

    return this.users.dispatch('organization.list', { params: opts })
      .then(({ data, meta }) => {
        assert.equal(meta.total, 1);
        assert.equal(meta.cursor, 1);
        assert.equal(meta.page, 1);
        assert.equal(meta.pages, 1);
        assert.deepEqual(data[0].attributes, organization);
      });
  });

  it('must be able to return organizations by username', async function test() {
    const opts = {
      username: this.userNames[0].email,
    };
    const { members, invites, ...organization } = this.organization;

    return this.users.dispatch('organization.list', { params: opts })
      .then(({ data }) => {
        const { relationships, ...org } = data[0].attributes;

        assert.ok(relationships);
        assert.deepEqual(org, organization);
      });
  });

  it('responds with member details on request byusername', async function test() {
    const opts = {
      username: this.userNames[0].email,
    };

    return this.users.dispatch('organization.list', { params: opts })
      .then(({ data }) => {
        const organization = data[0].attributes;

        assert(organization.relationships);
        const member = organization.relationships;
        assert(member);
        assert(member.id);
        assert.strictEqual(member.type, 'organizationMember');
        assert(member.attributes);
        assert(member.attributes.joinedAt);
      });
  });

  it('sort organizations by id ASC/DESC', async function test() {
    const opts = {
      criteria: 'id',
    };

    const jobs = [];
    const organizationsLength = 10;

    times(organizationsLength - 1, () => {
      jobs.push(createOrganization.call(this));
    });

    await Promise.all(jobs);

    await this.users.dispatch('organization.list', { params: opts })
      .then(({ data }) => {
        assert(data.length);

        for (let i = 1; i < data.length; i += 1) {
          const prev = BigInt(data[i - 1].id);
          const next = BigInt(data[i].id);

          assert(next > prev);
        }
      });

    return this.users.dispatch('organization.list', { params: { ...opts, order: 'DESC' } })
      .then(({ data }) => {
        assert(data.length);

        for (let i = 1; i < data.length; i += 1) {
          const prev = BigInt(data[i - 1].id);
          const next = BigInt(data[i].id);

          assert(next < prev);
        }
      });
  });
});

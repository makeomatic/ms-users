/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const assert = require('assert');
const { expect } = require('chai');
const times = require('lodash/times');
const { createOrganization } = require('../../helpers/organization');

describe('#organizations list', function registerSuite() {
  this.timeout(50000);

  beforeEach(global.startService);
  beforeEach(function () { return createOrganization.call(this); });
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

    return this.dispatch('users.organization.list', opts)
      .reflect()
      .then(inspectPromise(true))
      .then(({ data, meta }) => {
        assert.equal(meta.total, organizationsLength);
        assert.equal(meta.cursor, opts.limit + opts.offset);
        assert.equal(meta.page, 1);
        assert.equal(meta.pages, organizationsLength / opts.limit);
        data.forEach((organization) => {
          expect(organization).to.have.ownProperty('id');
          expect(organization).to.have.ownProperty('metadata');
          expect(organization).to.have.ownProperty('name');
          expect(organization).to.have.ownProperty('active');
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

    return this.dispatch('users.organization.list', opts)
      .reflect()
      .then(inspectPromise(true))
      .then(({ data, meta }) => {
        assert.equal(meta.total, 1);
        assert.equal(meta.cursor, 1);
        assert.equal(meta.page, 1);
        assert.equal(meta.pages, 1);
        assert.deepEqual(data[0], organization);
      });
  });
});

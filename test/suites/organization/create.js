/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const ld = require('lodash');
const assert = require('assert');
const redisKey = require('../../../src/utils/key.js');

describe('#create organization', function registerSuite() {
  this.timeout(50000);

  // const totalUsers = 105;
  // const faker = require('faker');

  beforeEach(global.startService);
  afterEach(global.clearRedis);
  beforeEach(function pretest() {
    return this
      .dispatch('users.register', {
        username: 'organizationMember@makeomatic.ru', password: '123', audience: '*.localhost', metadata: { name: 'member1' },
      })
      .then(({ user }) => {
        this.userId = user.id;
      });
  });

  // beforeEach('populate redis', function populateRedis() {
  //   const audience = this.users.config.jwt.defaultAudience;
  //   const promises = [];
  //   const { USERS_INDEX, USERS_METADATA } = require('../../../src/constants');
  //
  //   ld.times(totalUsers, () => {
  //     const user = {
  //       id: this.users.flake.next(),
  //       metadata: {
  //         username: faker.internet.email(),
  //         firstName: faker.name.firstName(),
  //         lastName: faker.name.lastName(),
  //       },
  //     };
  //
  //     promises.push((
  //       this.users.redis
  //         .pipeline()
  //         .sadd(USERS_INDEX, user.id)
  //         .hmset(
  //           redisKey(user.id, USERS_METADATA, audience),
  //           ld.mapValues(user.metadata, JSON.stringify.bind(JSON))
  //         )
  //         .exec()
  //     ));
  //   });
  //
  //   this.audience = audience;
  //   this.userStubs = Promise.all(promises);
  //   return this.userStubs;
  // });

  it('must reject invalid organization params and return detailed error', function test() {
    return this.dispatch('users.organization.create', {})
      .reflect()
      .then(inspectPromise(false))
      .then((createdOrganization) => {
        assert.equal(createdOrganization.name, 'HttpStatusError');
        assert.equal(createdOrganization.errors.length, 1);
      });
  });

  it('must be able to create organization', function test() {
    const opts = {
      name: 'Pied Piper',
      metadata: {
        description: 'test organization',
      },
      members: [{
        id: this.userId,
      }],
    };

    return this.dispatch('users.organization.create', opts)
      .reflect()
      .then(inspectPromise(true))
      .then((createdOrganization) => {
        assert.equal(createdOrganization.name, opts.name);
        assert.ok(createdOrganization.id);
      });
  });
});

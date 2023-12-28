/* eslint-disable no-prototype-builtins */
const ld = require('lodash');
const assert = require('node:assert/strict');
const { faker } = require('@faker-js/faker');
const redisKey = require('../../../src/utils/key');
const { redisIndexDefinitions } = require('../../configs/redis-indexes');
const { startService, clearRedis } = require('../../config');

for (const redisSearchEnabled of [false, true]) { // testing in two mode
  describe(`#list [FT:${redisSearchEnabled}]`, function listSuite() {
    this.timeout(50000);

    const ctx = {
      redisSearch: {
        enabled: redisSearchEnabled,
      },
      redisIndexDefinitions,
    };

    const totalUsers = 105;

    beforeEach(async function init() {
      await startService.call(this, ctx);
    });
    afterEach('reset redis', clearRedis);

    beforeEach('populate redis', function populateRedis() {
      const audience = this.users.config.jwt.defaultAudience;
      const promises = [];
      const { USERS_INDEX, USERS_METADATA } = require('../../../src/constants');

      ld.times(totalUsers, () => {
        const user = {
          id: this.users.flake.next(),
          metadata: {
            username: faker.internet.email(),
            firstName: faker.person.firstName(),
            lastName: faker.person.lastName(),
          },
        };

        promises.push((
          this.users.redis
            .pipeline()
            .sadd(USERS_INDEX, user.id)
            .hmset(
              redisKey(user.id, USERS_METADATA, audience),
              ld.mapValues(user.metadata, JSON.stringify.bind(JSON))
            )
            .exec()
        ));
      });

      this.audience = audience;
      this.userStubs = Promise.all(promises);
      return this.userStubs;
    });

    it('able to list users without any filters: ASC', function test() {
      return this
        .users
        .dispatch('list', {
          params: {
            offset: 51,
            limit: 10,
            order: 'ASC',
            audience: this.audience,
            filter: {},
          },
        })
        .then((result) => {
          assert.equal(result.page, 6);
          assert.equal(result.pages, 11);
          assert.equal(result.cursor, 61);
          assert.equal(result.total, totalUsers);
          assert.equal(result.users.length, 10);

          result.users.forEach((user) => {
            assert(user.hasOwnProperty('id'));
            assert(user.hasOwnProperty('metadata'));
            assert(user.metadata[this.audience].hasOwnProperty('firstName'));
            assert(user.metadata[this.audience].hasOwnProperty('lastName'));
          });

          const copy = [].concat(result.users);
          copy.sort((a, b) => a.id.toLowerCase() > b.id.toLowerCase());

          assert.deepEqual(copy, result.users);
        });
    });

    it('able to list users without any filters with default limit', async function test() {
      const result = await this.users.dispatch('list', {
        params: {
          offset: 0,
          order: 'ASC',
          audience: this.audience,
          filter: {},
        },
      });

      assert.equal(result.page, 1);
      assert.equal(result.pages, 11);
      assert.equal(result.cursor, 10);
      assert.equal(result.total, totalUsers);
      assert.equal(result.users.length, 10);

      result.users.forEach((user) => {
        assert(user.hasOwnProperty('id'));
        assert(user.hasOwnProperty('metadata'));
        assert(user.metadata[this.audience].hasOwnProperty('firstName'));
        assert(user.metadata[this.audience].hasOwnProperty('lastName'));
      });

      const copy = [].concat(result.users);
      copy.sort((a, b) => a.id.toLowerCase() > b.id.toLowerCase());

      assert.deepEqual(copy, result.users);
    });

    it('able to list users without any filters: DESC', function test() {
      return this
        .users
        .dispatch('list', {
          params: {
            offset: 0,
            limit: 10,
            order: 'DESC',
            audience: this.audience,
            filter: {},
          },
        })
        .then((result) => {
          assert.equal(result.users.length, 10);

          result.users.forEach((user) => {
            assert(user.hasOwnProperty('id'));
            assert(user.hasOwnProperty('metadata'));
            assert(user.metadata[this.audience].hasOwnProperty('firstName'));
            assert(user.metadata[this.audience].hasOwnProperty('lastName'));
          });

          const copy = [].concat(result.users);
          copy.sort((a, b) => a.id.toLowerCase() < b.id.toLowerCase());

          assert.deepEqual(copy, result.users);
        });
    });

    it('able to list users with `username` filter: ASC', function test() {
      return this
        .users
        .dispatch('list', {
          params: {
            offset: 0,
            limit: 10,
            order: 'ASC',
            audience: this.audience,
            filter: {
              username: 'an',
            },
          },
        })
        .then((result) => {
          assert(result.users.length <= 10);

          result.users.forEach((user) => {
            assert(user.hasOwnProperty('id'));
            assert(user.hasOwnProperty('metadata'));
            assert(user.metadata[this.audience].hasOwnProperty('firstName'));
            assert(user.metadata[this.audience].hasOwnProperty('lastName'));
          });

          const copy = [].concat(result.users);
          copy.sort((a, b) => a.id.toLowerCase() > b.id.toLowerCase());

          copy.forEach((data) => {
            assert(/an/i.test(data.metadata[this.audience].username));
          });
        });
    });

    it('able to list users with `username` filter: DESC', function test() {
      return this
        .users
        .dispatch('list', {
          params: {
            offset: 0,
            limit: 10,
            order: 'DESC',
            audience: this.audience,
            filter: {
              username: 'an',
            },
          },
        })
        .then((result) => {
          assert(result.users.length <= 10);

          result.users.forEach((user) => {
            assert(user.hasOwnProperty('id'));
            assert(user.hasOwnProperty('metadata'));
            assert(user.metadata[this.audience].hasOwnProperty('firstName'));
            assert(user.metadata[this.audience].hasOwnProperty('lastName'));
          });

          const copy = [].concat(result.users);
          copy.sort((a, b) => a.id.toLowerCase() < b.id.toLowerCase());

          copy.forEach((data) => {
            assert(/an/i.test(data.metadata[this.audience].username));
          });
        });
    });

    it('able to list users by meta field key: ASC', function test() {
      return this
        .users
        .dispatch('list', {
          params: {
            offset: 0,
            limit: 10,
            order: 'ASC',
            criteria: 'firstName',
            audience: this.audience,
            filter: {},
          },
        })
        .then((result) => {
          assert(result.users.length <= 10);

          result.users.forEach((user) => {
            assert(user.hasOwnProperty('id'));
            assert(user.hasOwnProperty('metadata'));
            assert(user.metadata[this.audience].hasOwnProperty('firstName'));
            assert(user.metadata[this.audience].hasOwnProperty('lastName'));
          });

          const copy = [].concat(result.users);
          copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() > b.metadata[this.audience].firstName.toLowerCase());

          assert.deepEqual(copy, result.users);
        });
    });

    it('able to list users by meta field key: DESC', function test() {
      return this
        .users
        .dispatch('list', {
          params: {
            offset: 0,
            limit: 10,
            order: 'DESC',
            criteria: 'firstName',
            audience: this.audience,
            filter: {},
          },
        })
        .then((result) => {
          assert(result.users.length <= 10);

          result.users.forEach((user) => {
            assert(user.hasOwnProperty('id'));
            assert(user.hasOwnProperty('metadata'));
            assert(user.metadata[this.audience].hasOwnProperty('firstName'));
            assert(user.metadata[this.audience].hasOwnProperty('lastName'));
          });

          const copy = [].concat(result.users);
          copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() < b.metadata[this.audience].firstName.toLowerCase());

          assert.deepEqual(copy, result.users);
        });
    });

    it('able to list users by meta field key with multiple filters: DESC', function test() {
      return this
        .users
        .dispatch('list', {
          params: {
            offset: 0,
            limit: 10,
            order: 'DESC',
            criteria: 'firstName',
            audience: this.audience,
            filter: {
              '#': 'an',
              lastName: 'b',
            },
          },
        })
        .then((result) => {
          assert(result.users.length <= 10);

          result.users.forEach((user) => {
            assert(user.hasOwnProperty('id'));
            assert(user.hasOwnProperty('metadata'));
            assert(user.metadata[this.audience].hasOwnProperty('firstName'));
            assert(user.metadata[this.audience].hasOwnProperty('lastName'));
          });

          const copy = [].concat(result.users);
          copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() < b.metadata[this.audience].firstName.toLowerCase());

          copy.forEach((data) => {
            assert(/an/i.test(data.id));
            assert(/b/i.test(data.metadata[this.audience].lastName));
          });

          assert.deepEqual(copy, result.users);
        });
    });

    it('able to list users by meta field key with multiple filters: ASC', function test() {
      return this
        .users
        .dispatch('list', {
          params: {
            offset: 0,
            limit: 10,
            order: 'ASC',
            criteria: 'lastName',
            audience: this.audience,
            filter: {
              '#': 'an',
              lastName: 'b',
            },
          },
        })
        .then((result) => {
          assert(result.users.length <= 10);

          result.users.forEach((user) => {
            assert(user.hasOwnProperty('id'));
            assert(user.hasOwnProperty('metadata'));
            assert(user.metadata[this.audience].hasOwnProperty('firstName'));
            assert(user.metadata[this.audience].hasOwnProperty('lastName'));
          });

          const copy = [].concat(result.users);
          copy.sort((a, b) => a.metadata[this.audience].lastName.toLowerCase() > b.metadata[this.audience].lastName.toLowerCase());

          copy.forEach((data) => {
            assert(/an/i.test(data.id));
            assert(/b/i.test(data.metadata[this.audience].lastName));
          });

          assert.deepEqual(copy, result.users);
        });
    });

    describe('.userIdsOnly returns only []ids', function userIdsOnlySuite() {
      it('run query with ids only', function test() {
        return this
          .users
          .dispatch('list', {
            params: {
              userIdsOnly: true,
              audience: this.audience,
            },
          })
          .then((result) => {
            assert.equal(result.page, 1);
            assert.equal(result.pages, 11);
            assert.equal(result.cursor, 10);
            assert.equal(result.total, totalUsers);

            assert.equal(result.users.length, 10);
            assert.equal(Array.isArray(result.users), true);

            // ensure that raw ids are returned
            result.users.forEach((id) => {
              assert.equal(typeof id, 'string');
            });
          });
      });
    });
  });
}

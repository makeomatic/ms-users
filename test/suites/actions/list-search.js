const Promise = require('bluebird');
const { expect } = require('chai');
const ld = require('lodash');
const redisKey = require('../../../src/utils/key');

const getUserName = (audience) => (data) => data.metadata[audience].username;

const sortByCaseInsensitive = (getMember) => (list) => list
  .sort((a, b) => getMember(a).toLowerCase() < getMember(b).toLowerCase());

describe('Redis Search: list', function listSuite() {
  this.timeout(50000);

  const ctx = {
    redisSearch: {
      enabled: true,
    },
  };

  const totalUsers = 105;
  const { faker } = require('@faker-js/faker');

  beforeEach(async function startService() {
    await global.startService.call(this, ctx);
  });
  afterEach('reset redis', global.clearRedis);

  beforeEach('populate redis', function populateRedis() {
    const audience = this.users.config.jwt.defaultAudience;
    const promises = [];
    const { USERS_INDEX, USERS_METADATA } = require('../../../src/constants');

    ld.times(totalUsers, () => {
      const user = {
        id: this.users.flake.next(),
        metadata: {
          username: faker.internet.email(),
          firstName: faker.name.firstName(),
          lastName: faker.name.lastName(),
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

  it('list by username', function test() {
    return this
      .users
      .dispatch('list', {
        params: {
          offset: 0,
          limit: 10,
          criteria: 'username', // sort by
          audience: this.audience,
          filter: {
            username: 'yahoo',
          },
        },
      })
      .then((result) => {
        console.log('USERS=', result.users);

        expect(result.users).to.have.length.lte(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const byUsername = getUserName(this.audience);

        const copy = [].concat(result.users);
        sortByCaseInsensitive(byUsername)(copy);

        copy.forEach((data) => {
          expect(data.metadata[this.audience].username).to.match(/yahoo/i);
        });

        expect(copy).to.be.deep.eq(result.users);
      });
  });
});

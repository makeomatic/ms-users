const Promise = require('bluebird');
const { strict: assert } = require('assert');
const { expect } = require('chai');
const { faker } = require('@faker-js/faker');
const ld = require('lodash');
const redisKey = require('../../../src/utils/key');
const { USERS_INDEX, USERS_METADATA } = require('../../../src/constants');

const getUserName = (audience) => (data) => data.metadata[audience].username;

const sortByCaseInsensitive = (getMember) => (list) => list
  .sort((a, b) => getMember(a).toLowerCase() < getMember(b).toLowerCase());

const createUser = (id, { username, firstName, lastName } = {}) => ({
  id,
  metadata: {
    username: username || faker.internet.email(),
    firstName: firstName || faker.name.firstName(),
    lastName: lastName || faker.name.lastName(),
  },
});

const saveUser = (redis, audience, user) => redis
  .pipeline()
  .sadd(USERS_INDEX, user.id)
  .hmset(
    redisKey(user.id, USERS_METADATA, audience),
    ld.mapValues(user.metadata, JSON.stringify.bind(JSON))
  )
  .exec();

describe('Redis Search: list', function listSuite() {
  this.timeout(50000);

  const ctx = {
    redisSearch: {
      enabled: true,
    },
  };

  const totalUsers = 5;

  beforeEach(async function startService() {
    await global.startService.call(this, ctx);
  });
  afterEach('reset redis', global.clearRedis);

  beforeEach('populate redis', function populateRedis() {
    const audience = this.users.config.jwt.defaultAudience;
    const promises = [];

    ld.times(totalUsers, () => {
      const user = createUser(this.users.flake.next());
      const item = saveUser(this.users.redis, audience, user);
      promises.push(item);
    });

    const people = [
      { username: 'ann@gmail.org', firstName: 'Ann', lastName: faker.lastName },
      { username: 'johnny@gmail.org', firstName: 'Johhny', lastName: faker.lastName },
      { username: 'joe@yahoo.org', firstName: 'Joe', lastName: faker.lastName },
      { username: 'ann@yahoo.org', firstName: 'Anna', lastName: faker.lastName },
    ];

    for (const x of people) {
      const user = createUser(this.users.flake.next(), { ...x });
      const inserted = saveUser(this.users.redis, audience, user);
      promises.push(inserted);
    }

    this.audience = audience;
    this.extractUserName = getUserName(this.audience);

    this.userStubs = Promise.all(promises);
    return this.userStubs;
  });

  it('responds with error when index not created', async function test() {
    const query = {
      params: {
        audience: 'not-existing-audience',
      },
    };

    await assert.rejects(
      this.users.dispatch('list', query),
      /Search index does not registered for/
    );
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
        expect(result.users).to.have.length.lte(10);
        expect(result.users.length);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        sortByCaseInsensitive(this.extractUserName)(copy);

        copy.forEach((data) => {
          expect(data.metadata[this.audience].username).to.match(/yahoo/i);
        });

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('list by first name', function test() {
    return this
      .users
      .dispatch('list', {
        params: {
          offset: 0,
          limit: 5,
          criteria: 'firstName',
          audience: this.audience,
          filter: {
            firstName: 'Johhny',
          },
        },
      })
      .then((result) => {
        assert(result);
        expect(result.users).to.have.length(1);
        const [u1] = result.users;

        assert(u1);
        const uname = this.extractUserName(u1);
        expect(uname).to.be.equal('johnny@gmail.org');
      });
  });
});

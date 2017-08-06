const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const { expect } = require('chai');
const redisKey = require('../../src/utils/key.js');
const ld = require('lodash');

describe('#list', function listSuite() {
  this.timeout(20000);

  const faker = require('faker');

  beforeEach('start service', global.startService);
  afterEach('reset redis', global.clearRedis);

  beforeEach('populate redis', function populateRedis() {
    const audience = this.users._config.jwt.defaultAudience;
    const promises = [];
    const { USERS_INDEX, USERS_METADATA } = require('../../src/constants');

    ld.times(105, () => {
      const user = {
        id: faker.internet.email(),
        metadata: {
          firstName: faker.name.firstName(),
          lastName: faker.name.lastName(),
        },
      };

      promises.push(this.users._redis
        .pipeline()
        .sadd(USERS_INDEX, user.id)
        .hmset(
          redisKey(user.id, USERS_METADATA, audience),
          ld.mapValues(user.metadata, JSON.stringify.bind(JSON))
        )
        .exec()
      );
    });

    this.audience = audience;
    this.userStubs = Promise.all(promises);
    return this.userStubs;
  });

  it('able to list users without any filters: ASC', function test() {
    return this
      .dispatch('users.list', {
        offset: 51,
        limit: 10,
        order: 'ASC',
        audience: this.audience,
        filter: {},
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        expect(result.page).to.be.eq(6);
        expect(result.pages).to.be.eq(11);
        expect(result.cursor).to.be.eq(61);
        expect(result.users).to.have.lengthOf(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        copy.sort((a, b) => a.id.toLowerCase() > b.id.toLowerCase());

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('able to list users without any filters: DESC', function test() {
    return this
      .dispatch('users.list', {
        offset: 0,
        limit: 10,
        order: 'DESC',
        audience: this.audience,
        filter: {},
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        expect(result.users).to.have.lengthOf(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        copy.sort((a, b) => a.id.toLowerCase() < b.id.toLowerCase());

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('able to list users with # filter: ASC', function test() {
    return this
      .dispatch('users.list', {
        offset: 0,
        limit: 10,
        order: 'ASC',
        audience: this.audience,
        filter: {
          '#': 'an',
        },
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        expect(result.users).to.have.length.lte(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        copy.sort((a, b) => a.id.toLowerCase() > b.id.toLowerCase());

        copy.forEach((data) => {
          expect(data.id).to.match(/an/i);
        });

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('able to list users with # filter: DESC', function test() {
    return this
      .dispatch('users.list', {
        offset: 0,
        limit: 10,
        order: 'DESC',
        audience: this.audience,
        filter: {
          '#': 'an',
        },
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        expect(result.users).to.have.length.lte(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        copy.sort((a, b) => a.id.toLowerCase() < b.id.toLowerCase());

        copy.forEach((data) => {
          expect(data.id).to.match(/an/i);
        });

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('able to list users by meta field key: ASC', function test() {
    return this
      .dispatch('users.list', {
        offset: 0,
        limit: 10,
        order: 'ASC',
        criteria: 'firstName',
        audience: this.audience,
        filter: {},
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        expect(result.users).to.have.length.lte(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() > b.metadata[this.audience].firstName.toLowerCase());

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('able to list users by meta field key: DESC', function test() {
    return this
      .dispatch('users.list', {
        offset: 0,
        limit: 10,
        order: 'DESC',
        criteria: 'firstName',
        audience: this.audience,
        filter: {},
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        expect(result.users).to.have.length.lte(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() < b.metadata[this.audience].firstName.toLowerCase());

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('able to list users by meta field key with multiple filters: DESC', function test() {
    return this
      .dispatch('users.list', {
        offset: 0,
        limit: 10,
        order: 'DESC',
        criteria: 'firstName',
        audience: this.audience,
        filter: {
          '#': 'an',
          lastName: 'b',
        },
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        expect(result.users).to.have.length.lte(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() < b.metadata[this.audience].firstName.toLowerCase());

        copy.forEach((data) => {
          expect(data.id).to.match(/an/i);
          expect(data.metadata[this.audience].lastName).to.match(/b/i);
        });

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  it('able to list users by meta field key with multiple filters: ASC', function test() {
    return this
      .dispatch('users.list', {
        offset: 0,
        limit: 10,
        order: 'ASC',
        criteria: 'lastName',
        audience: this.audience,
        filter: {
          '#': 'an',
          lastName: 'b',
        },
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        expect(result.users).to.have.length.lte(10);

        result.users.forEach((user) => {
          expect(user).to.have.ownProperty('id');
          expect(user).to.have.ownProperty('metadata');
          expect(user.metadata[this.audience]).to.have.ownProperty('firstName');
          expect(user.metadata[this.audience]).to.have.ownProperty('lastName');
        });

        const copy = [].concat(result.users);
        copy.sort((a, b) => a.metadata[this.audience].lastName.toLowerCase() > b.metadata[this.audience].lastName.toLowerCase());

        copy.forEach((data) => {
          expect(data.id).to.match(/an/i);
          expect(data.metadata[this.audience].lastName).to.match(/b/i);
        });

        expect(copy).to.be.deep.eq(result.users);
      });
  });

  describe('.userIdsOnly returns only []ids', function userIdsOnlySuite() {
    it('run query with ids only', function test() {
      return this
        .dispatch('users.list', {
          userIdsOnly: true,
          audience: this.audience,
        })
        .reflect()
        .then(inspectPromise())
        .then((result) => {
          expect(result.page).to.be.eq(1);
          expect(result.pages).to.be.eq(11);
          expect(result.cursor).to.be.eq(10);

          expect(result.users).to.have.lengthOf(10);
          expect(Array.isArray(result.users)).to.be.eq(true);

          // ensure that raw ids are returned
          result.users.forEach((id) => {
            expect(typeof id).to.be.eq('string');
          });
        });
    });
  });
});

/* global inspectPromise */
const { expect } = require('chai');
const { User } = require('../../src/model/usermodel');
const ld = require('lodash');

describe('#list', function listSuite() {
  this.timeout(10000);

  const faker = require('faker');
  const headers = { routingKey: 'users.list' };

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function populateUsers() {
    const audience = this.users._config.jwt.defaultAudience;
    const promises = [];
    const { USERS_INDEX, USERS_METADATA } = require('../../src/constants.js');

    ld.times(105, () => {
      const userData = {
        username: faker.internet.email(),
        audience,
        metadata: {
          $set: {
            firstName: faker.name.firstName(),
            lastName: faker.name.lastName(),
          },
        },
      };
      promises.push(
        User.create.call(this.users, userData.username, '', '123', true).then(() => User.setMeta.call(this.users, userData))
      );
    });

    this.audience = audience;
    this.userStubs = Promise.all(promises);
    return this.userStubs;
  });

  it('able to list users without any filters: ASC', function test() {
    return this.users.router({
      offset: 51,
      limit: 10,
      order: 'ASC',
      audience: this.audience,
      filter: {},
    }, headers)
    .reflect()
    .then(result => {

      try {
        expect(result.isFulfilled()).to.be.eq(true);
        expect(result.value().page).to.be.eq(6);
        expect(result.value().pages).to.be.eq(11);
        expect(result.value().cursor).to.be.eq(61);
        expect(result.value().users).to.have.length.of(10);
        expect(result.value().users[0]).to.have.ownProperty('id');
        expect(result.value().users[0]).to.have.ownProperty('metadata');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

        const copy = [].concat(result.value().users);
        copy.sort((a, b) => a.id.toLowerCase() > b.id.toLowerCase());

        expect(copy).to.be.deep.eq(result.value().users);
      } catch (e) {
        throw result.isRejected() ? result.reason() : e;
      }
    });
  });

  it('able to list users without any filters: DESC', function test() {
    return this.users.router({
      offset: 0,
      limit: 10,
      order: 'DESC',
      audience: this.audience,
      filter: {},
    }, headers)
    .reflect()
    .then(result => {
      try {
        expect(result.isFulfilled()).to.be.eq(true);
        expect(result.value().users).to.have.length.of(10);
        expect(result.value().users[0]).to.have.ownProperty('id');
        expect(result.value().users[0]).to.have.ownProperty('metadata');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

        const copy = [].concat(result.value().users);
        copy.sort((a, b) => a.id.toLowerCase() < b.id.toLowerCase());

        expect(copy).to.be.deep.eq(result.value().users);
      } catch (e) {
        throw result.isRejected() ? result.reason() : e;
      }
    });
  });

  it('able to list users with # filter: ASC', function test() {
    return this.users.router({
      offset: 0,
      limit: 10,
      order: 'ASC',
      audience: this.audience,
      filter: {
        '#': 'an',
      },
    }, headers)
    .reflect()
    .then(result => {
      try {
        expect(result.isFulfilled()).to.be.eq(true);
        expect(result.value().users).to.have.length.lte(10);
        expect(result.value().users[0]).to.have.ownProperty('id');
        expect(result.value().users[0]).to.have.ownProperty('metadata');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

        const copy = [].concat(result.value().users);
        copy.sort((a, b) => a.id.toLowerCase() > b.id.toLowerCase());

        copy.forEach((data) => {
          expect(data.id).to.match(/an/i);
        });

        expect(copy).to.be.deep.eq(result.value().users);
      } catch (e) {
        throw result.isRejected() ? result.reason() : e;
      }
    });
  });

  it('able to list users with # filter: DESC', function test() {
    return this.users.router({
      offset: 0,
      limit: 10,
      order: 'DESC',
      audience: this.audience,
      filter: {
        '#': 'an',
      },
    }, headers)
    .reflect()
    .then(result => {
      try {
        expect(result.isFulfilled()).to.be.eq(true);
        expect(result.value().users).to.have.length.lte(10);
        expect(result.value().users[0]).to.have.ownProperty('id');
        expect(result.value().users[0]).to.have.ownProperty('metadata');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

        const copy = [].concat(result.value().users);
        copy.sort((a, b) => a.id.toLowerCase() < b.id.toLowerCase());

        copy.forEach((data) => {
          expect(data.id).to.match(/an/i);
        });

        expect(copy).to.be.deep.eq(result.value().users);
      } catch (e) {
        throw result.isRejected() ? result.reason() : e;
      }
    });
  });

  it('able to list users by meta field key: ASC', function test() {
    return this.users.router({
      offset: 0,
      limit: 10,
      order: 'ASC',
      criteria: 'firstName',
      audience: this.audience,
      filter: {},
    }, headers)
    .reflect()
    .then(result => {
      try {
        expect(result.isFulfilled()).to.be.eq(true);
        expect(result.value().users).to.have.length.lte(10);
        expect(result.value().users[0]).to.have.ownProperty('id');
        expect(result.value().users[0]).to.have.ownProperty('metadata');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

        const copy = [].concat(result.value().users);
        copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() > b.metadata[this.audience].firstName.toLowerCase());

        expect(copy).to.be.deep.eq(result.value().users);
      } catch (e) {
        throw result.isRejected() ? result.reason() : e;
      }
    });
  });

  it('able to list users by meta field key: DESC', function test() {
    return this.users.router({
      offset: 0,
      limit: 10,
      order: 'DESC',
      criteria: 'firstName',
      audience: this.audience,
      filter: {},
    }, headers)
    .reflect()
    .then(result => {
      try {
        expect(result.isFulfilled()).to.be.eq(true);
        expect(result.value().users).to.have.length.lte(10);
        expect(result.value().users[0]).to.have.ownProperty('id');
        expect(result.value().users[0]).to.have.ownProperty('metadata');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

        const copy = [].concat(result.value().users);
        copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() < b.metadata[this.audience].firstName.toLowerCase());

        expect(copy).to.be.deep.eq(result.value().users);
      } catch (e) {
        throw result.isRejected() ? result.reason() : e;
      }
    });
  });

  it('able to list users by meta field key with multiple filters: DESC', function test() {
    return this.users.router({
      offset: 0,
      limit: 10,
      order: 'DESC',
      criteria: 'firstName',
      audience: this.audience,
      filter: {
        '#': 'an',
        lastName: 'b',
      },
    }, headers)
    .reflect()
    .then(result => {
      try {
        expect(result.isFulfilled()).to.be.eq(true);
        expect(result.value().users).to.have.length.lte(10);
        expect(result.value().users[0]).to.have.ownProperty('id');
        expect(result.value().users[0]).to.have.ownProperty('metadata');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

        const copy = [].concat(result.value().users);
        copy.sort((a, b) => a.metadata[this.audience].firstName.toLowerCase() < b.metadata[this.audience].firstName.toLowerCase());

        copy.forEach((data) => {
          expect(data.id).to.match(/an/i);
          expect(data.metadata[this.audience].lastName).to.match(/b/i);
        });

        expect(copy).to.be.deep.eq(result.value().users);
      } catch (e) {
        throw result.isRejected() ? result.reason() : e;
      }
    });
  });

  it('able to list users by meta field key with multiple filters: ASC', function test() {
    return this.users.router({
      offset: 0,
      limit: 10,
      order: 'ASC',
      criteria: 'lastName',
      audience: this.audience,
      filter: {
        '#': 'an',
        lastName: 'b',
      },
    }, headers)
    .reflect()
    .then(result => {
      try {
        expect(result.isFulfilled()).to.be.eq(true);
        expect(result.value().users).to.have.length.lte(10);
        expect(result.value().users[0]).to.have.ownProperty('id');
        expect(result.value().users[0]).to.have.ownProperty('metadata');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
        expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

        const copy = [].concat(result.value().users);
        copy.sort((a, b) => a.metadata[this.audience].lastName.toLowerCase() > b.metadata[this.audience].lastName.toLowerCase());

        copy.forEach(data => {
          expect(data.id).to.match(/an/i);
          expect(data.metadata[this.audience].lastName).to.match(/b/i);
        });

        expect(copy).to.be.deep.eq(result.value().users);
      } catch (e) {
        throw result.isRejected() ? result.reason() : e;
      }
    });
  });
});

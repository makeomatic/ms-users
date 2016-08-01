/* global inspectPromise */
const { expect } = require('chai');
const redisKey = require('../../src/utils/key.js');
const ld = require('lodash');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#login', function loginSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };
  const { USERS_BANNED_FLAG, USERS_DATA } = require('../../src/constants.js');

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject login on a non-existing username', function test() {
    return simpleDispatcher(this.users.router)('users.login', user)
      .reflect()
      .then(inspectPromise(false))
      .then(login => {
        expect(login.name).to.be.eq('HttpStatusError');
        expect(login.statusCode).to.be.eq(404);
      });
  });

  describe('existing user: inactivate', function userSuite() {
    beforeEach(function pretest() {
      return simpleDispatcher(this.users.router)('users.register', {
        ...userWithValidPassword,
        activate: false,
        skipChallenge: true,
      });
    });

    it('must reject login on an inactive account', function test() {
      return simpleDispatcher(this.users.router)('users.login', userWithValidPassword)
        .reflect()
        .then(inspectPromise(false))
        .then(login => {
          try {
            expect(login.name).to.be.eq('HttpStatusError');
            expect(login.statusCode).to.be.eq(412);
          } catch (error) {
            throw login;
          }
        });
    });
  });

  describe('existing user: active', function userSuite() {
    beforeEach(function pretest() {
      return simpleDispatcher(this.users.router)('users.register', userWithValidPassword);
    });

    it('must reject login on an invalid password', function test() {
      return simpleDispatcher(this.users.router)('users.login', user)
        .reflect()
        .then(inspectPromise(false))
        .then(login => {
          expect(login.name).to.be.eq('HttpStatusError');
          expect(login.statusCode).to.be.eq(403);
        });
    });

    describe('account: with alias', function suite() {
      const alias = 'bond';

      beforeEach(function pretest() {
        return simpleDispatcher(this.users.router)('users.alias', { username: userWithValidPassword.username, alias });
      });

      it('allows to sign in with a valid alias', function test() {
        return simpleDispatcher(this.users.router)('users.login', { ...userWithValidPassword, username: alias })
          .reflect()
          .then(inspectPromise());
      });
    });

    describe('account: banned', function suite() {
      beforeEach(function pretest() {
        return this.users.redis.hset(redisKey(user.username, USERS_DATA), USERS_BANNED_FLAG, 'true');
      });

      it('must reject login', function test() {
        return simpleDispatcher(this.users.router)('users.login', userWithValidPassword)
          .reflect()
          .then(inspectPromise(false))
          .then(login => {
            expect(login.name).to.be.eq('HttpStatusError');
            expect(login.statusCode).to.be.eq(423);
          });
      });
    });

    it('must login on a valid account with correct credentials', function test() {
      return simpleDispatcher(this.users.router)('users.login', userWithValidPassword)
        .reflect()
        .then(inspectPromise());
    });

    it('must lock account for authentication after 5 invalid login attemps', function test() {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const promises = [];

      ld.times(5, () => {
        promises.push(
          simpleDispatcher(this.users.router)('users.login', userWithRemoteIP)
            .reflect()
            .then(inspectPromise(false))
            .then(login => {
              expect(login.name).to.be.eq('HttpStatusError');
              expect(login.statusCode).to.be.eq(403);
            })
        );
      });

      promises.push(
        simpleDispatcher(this.users.router)('users.login', userWithRemoteIP)
          .reflect()
          .then(inspectPromise(false))
          .then(login => {
            expect(login.name).to.be.eq('HttpStatusError');
            expect(login.statusCode).to.be.eq(429);
          })
      );

      return Promise.all(promises);
    });
  });
});

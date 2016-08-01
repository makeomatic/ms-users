/* global inspectPromise */
const { expect } = require('chai');
const ld = require('lodash');

describe('#login', function loginSuite() {
  const { User } = require('../../src/model/usermodel');
  const headers = { routingKey: 'users.login' };
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };
  const { USERS_BANNED_FLAG, USERS_DATA } = require('../../src/constants.js');

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject login on a non-existing username', function test() {
    return this.users.router(user, headers)
      .reflect()
      .then(inspectPromise(false))
      .then(login => {
        expect(login.name).to.be.eq('HttpStatusError');
        expect(login.statusCode).to.be.eq(404);
      });
  });

  describe('existing user: inactivate', function userSuite() {
    beforeEach(function pretest() {
      return this.users.router({
        ...userWithValidPassword,
        activate: false,
        skipChallenge: true,
      }, { routingKey: 'users.register' });
    });

    it('must reject login on an inactive account', function test() {
      return this.users.router(userWithValidPassword, headers)
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
      return this.users.router(userWithValidPassword, { routingKey: 'users.register' });
    });

    it('must reject login on an invalid password', function test() {
      return this.users.router(user, headers)
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
        return this.users.router({ username: userWithValidPassword.username, alias }, { routingKey: 'users.alias' });
      });

      it('allows to sign in with a valid alias', function test() {
        return this
          .users
          .router({ ...userWithValidPassword, username: alias }, { routingKey: 'users.login' })
          .reflect()
          .then(inspectPromise());
      });
    });

    describe('account: banned', function suite() {
      beforeEach(function pretest() {
        return User.lock.call(this.users, { username: user.username });
      });

      it('must reject login', function test() {
        return this.users.router(userWithValidPassword, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(login => {
            expect(login.name).to.be.eq('HttpStatusError');
            expect(login.statusCode).to.be.eq(423);
          });
      });
    });

    it('must login on a valid account with correct credentials', function test() {
      return this.users.router(userWithValidPassword, headers)
        .reflect()
        .then(inspectPromise());
    });

    it('must lock account for authentication after 5 invalid login attemps', function test() {
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const promises = [];

      ld.times(5, () => {
        promises.push(
          this.users.router(userWithRemoteIP, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(login => {
              expect(login.name).to.be.eq('HttpStatusError');
              expect(login.statusCode).to.be.eq(403);
            })
        );
      });

      promises.push(
        this.users.router(userWithRemoteIP, headers)
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

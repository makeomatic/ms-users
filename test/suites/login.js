/* global inspectPromise */
const { expect } = require('chai');
const redisKey = require('../../src/utils/key.js');
const ld = require('lodash');

describe('#login', function loginSuite() {
  const headers = { routingKey: 'users.login' };
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };
  const scrypt = require('../../src/utils/scrypt.js');

  before(function test() {
    return scrypt.hash(userWithValidPassword.password).then(pass => {
      this.password = pass;
    });
  });

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
      return this.users.router({ ...userWithValidPassword, activate: false }, { routingKey: 'users.register' });
    });

    it('must reject login on an inactive account', function test() {
      return this.users.router(userWithValidPassword, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(login => {
          expect(login.name).to.be.eq('HttpStatusError');
          expect(login.statusCode).to.be.eq(412);
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

    describe('account: banned', function suite() {
      beforeEach(function pretest() {
        return this.users.redis.hset(redisKey(user.username, 'data'), 'banned', 'true');
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

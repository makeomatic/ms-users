/* global inspectPromise */
const { expect } = require('chai');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#ban', function banSuite() {
  const username = 'v@aminev.me';
  const password = '123';
  const audience = '*.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject banning a non-existing user', function test() {
    return simpleDispatcher(this.users.router)('users.ban', { username: 'doesntexist', ban: true })
      .reflect()
      .then(inspectPromise(false))
      .then(ban => {
        expect(ban.name).to.be.eq('HttpStatusError');
        expect(ban.statusCode).to.be.eq(404);
      });
  });

  describe('user: active', function suite() {
    beforeEach(function pretest() {
      return simpleDispatcher(this.users.router)('users.register', { username, password, audience });
    });

    it('must reject (un)banning a user without action being implicitly set', function test() {
      return simpleDispatcher(this.users.router)('users.ban', { username })
        .reflect()
        .then(inspectPromise(false))
        .then(ban => {
          expect(ban.name).to.be.eq('ValidationError');
        });
    });

    it('must be able to ban an existing user', function test() {
      return simpleDispatcher(this.users.router)('users.ban', { username, ban: true })
        .reflect()
        .then(inspectPromise())
        .then(ban => {
          expect(ban[0][1]).to.be.eq(1);
          expect(ban[1][1]).to.be.eq('OK');
        });
    });

    it('must be able to unban an existing user', function test() {
      return simpleDispatcher(this.users.router)('users.ban', { username, ban: true })
        .then(() => simpleDispatcher(this.users.router)('users.ban', { username, ban: false }))
        .reflect()
        .then(inspectPromise())
        .then(ban => {
          expect(ban[0][1]).to.be.eq(1);
          expect(ban[1][1]).to.be.eq(2);
        });
    });
  });
});

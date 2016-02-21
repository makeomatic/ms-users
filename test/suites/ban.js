/* global inspectPromise */
const { expect } = require('chai');

describe('#ban', function banSuite() {
  const headers = { routingKey: 'users.ban' };
  const username = 'v@aminev.me';
  const password = '123';
  const audience = '*.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject banning a non-existing user', function test() {
    return this
      .users
      .router({ username: 'doesntexist', ban: true }, headers)
      .reflect()
      .then(inspectPromise(false))
      .then(ban => {
        expect(ban.name).to.be.eq('HttpStatusError');
        expect(ban.statusCode).to.be.eq(404);
      });
  });

  describe('user: active', function suite() {
    beforeEach(function pretest() {
      return this
        .users
        .router({ username, password, audience }, { routingKey: 'users.register' });
    });

    it('must reject (un)banning a user without action being implicitly set', function test() {
      return this
        .users
        .router({ username }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(ban => {
          expect(ban.name).to.be.eq('ValidationError');
        });
    });

    it('must be able to ban an existing user', function test() {
      return this
        .users
        .router({ username, ban: true }, headers)
        .reflect()
        .then(inspectPromise())
        .then(ban => {
          expect(ban[0][1]).to.be.eq(1);
          expect(ban[1][1]).to.be.eq('OK');
        });
    });

    it('must be able to unban an existing user', function test() {
      return this
        .users
        .router({ username, ban: true }, headers)
        .then(() => this.users.router({ username, ban: false }, headers))
        .reflect()
        .then(inspectPromise())
        .then(ban => {
          expect(ban[0][1]).to.be.eq(1);
          expect(ban[1][1]).to.be.eq(2);
        });
    });
  });
});

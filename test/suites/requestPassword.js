/* global inspectPromise */
const { expect } = require('chai');
const redisKey = require('../../lib/utils/key.js');

describe('#requestPassword', function requestPasswordSuite() {
  const headers = { routingKey: 'users.requestPassword' };
  const username = 'v@makeomatic.ru';
  const audience = 'requestPassword';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function pretest() {
    return this.users.router({ username, password: '123', audience }, { routingKey: 'users.register' });
  });

  it('must fail when user does not exist', function test() {
    return this.users.router({ username: 'noob' }, headers)
      .reflect()
      .then(inspectPromise(false))
      .then(requestPassword => {
        expect(requestPassword.name).to.be.eq('HttpStatusError');
        expect(requestPassword.statusCode).to.be.eq(404);
      });
  });

  describe('account: inactive', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(username, 'data'), 'active', 'false');
    });

    it('must fail when account is inactive', function test() {
      return this.users.router({ username }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(requestPassword => {
          expect(requestPassword.name).to.be.eq('HttpStatusError');
          expect(requestPassword.statusCode).to.be.eq(412);
        });
    });
  });

  describe('account: banned', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(username, 'data'), 'ban', 'true');
    });

    it('must fail when account is banned', function test() {
      return this.users.router({ username }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(requestPassword => {
          expect(requestPassword.name).to.be.eq('HttpStatusError');
          expect(requestPassword.statusCode).to.be.eq(423);
        });
    });
  });

  describe('account: active', function suite() {
    it('must send challenge email for an existing user with an active account', function test() {
      return this.users.router({ username }, headers)
        .reflect()
        .then(requestPassword => {
          expect(requestPassword.isFulfilled()).to.be.eq(true);
          expect(requestPassword.value()).to.be.deep.eq({ success: true });
        });
    });

    it('must reject sending reset password emails for an existing user more than once in 3 hours', function test() {
      return this.users.router({ username }, headers)
        .then(() => {
          return this
            .users.router({ username }, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(requestPassword => {
              expect(requestPassword.name).to.be.eq('HttpStatusError');
              expect(requestPassword.statusCode).to.be.eq(429);
            });
        });
    });
  });
});

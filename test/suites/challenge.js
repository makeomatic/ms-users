/* global inspectPromise */
const { expect } = require('chai');

describe('#challenge', function challengeSuite() {
  const headers = { routingKey: 'users.challenge' };

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must fail to send a challenge for a non-existing user', function test() {
    return this.users
      .router({ username: 'oops@gmail.com', type: 'email' }, headers)
      .reflect()
      .then(inspectPromise(false))
      .then(validation => {
        expect(validation.name).to.be.eq('HttpStatusError');
        expect(validation.statusCode).to.be.eq(404);
      });
  });

  describe('challenge for an already active user', function suite() {
    beforeEach(function pretest() {
      return this.users
        .router({ username: 'oops@gmail.com', password: '123', audience: 'matic.ninja' }, { routingKey: 'users.register' });
    });

    it('must fail to send', function test() {
      return this.users
        .router({ username: 'oops@gmail.com', type: 'email' }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(validation => {
          expect(validation.name).to.be.eq('HttpStatusError');
          expect(validation.statusCode).to.be.eq(417);
        });
    });
  });

  describe('challenge for an inactive user', function suite() {
    function requestChallange() {
      return this.users.router({ username: 'oops@gmail.com', type: 'email' }, headers);
    }

    beforeEach(function pretest() {
      const msg = { username: 'oops@gmail.com', password: '123', audience: 'matic.ninja', activate: false, skipChallenge: true };
      return this.users.router(msg, { routingKey: 'users.register' });
    });

    it('must be able to send challenge email', function test() {
      return requestChallange.call(this)
        .reflect()
        .then(inspectPromise())
        .then(validation => {
          expect(validation).to.have.ownProperty('context');
          expect(validation.queued).to.be.eq(true);
        });
    });

    it('must fail to send challenge email more than once in an hour per user', function test() {
      return Promise.bind(this)
        .then(requestChallange)
        .then(requestChallange)
        .reflect()
        .then(inspectPromise(false))
        .then(validation => {
          expect(validation.name).to.be.eq('HttpStatusError');
          expect(validation.statusCode).to.be.eq(429);
        });
    });

    it('must fail to send challeng email during race condition', function test() {
      return Promise
        .bind(this)
        .return([requestChallange, requestChallange, requestChallange])
        .map(it => it.call(this))
        .reflect()
        .then(inspectPromise(false))
        .then(validation => {
          expect(validation.name).to.be.eq('HttpStatusError');
          expect(validation.statusCode).to.be.eq(429);
        });
    });
  });
});

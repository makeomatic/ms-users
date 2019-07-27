const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const { expect } = require('chai');

describe('#challenge', function challengeSuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must fail to send a challenge for a non-existing user', function test() {
    return this.dispatch('users.challenge', { username: 'oops@gmail.com', type: 'email' })
      .reflect()
      .then(inspectPromise(false))
      .then((validation) => {
        expect(validation.name).to.be.eq('HttpStatusError');
        expect(validation.statusCode).to.be.eq(404);
      });
  });

  describe('challenge for an already active user', function suite() {
    beforeEach(function pretest() {
      return this.dispatch('users.register', {
        username: 'oops@gmail.com',
        password: '123',
        audience: 'matic.ninja',
        metadata: {
          wolf: true,
        },
      });
    });

    it('must fail to send', function test() {
      return this.dispatch('users.challenge', { username: 'oops@gmail.com', type: 'email' })
        .reflect()
        .then(inspectPromise(false))
        .then((validation) => {
          expect(validation.name).to.be.eq('HttpStatusError');
          expect(validation.statusCode).to.be.eq(417);
        });
    });
  });

  describe('challenge for an inactive user', function suite() {
    function requestChallenge() {
      return this.dispatch('users.challenge', { username: 'oops@gmail.com', type: 'email' });
    }

    beforeEach(function pretest() {
      const msg = {
        username: 'oops@gmail.com',
        password: '123',
        audience: 'matic.ninja',
        activate: false,
        skipChallenge: true,
        metadata: {
          wolf: true,
        },
      };
      return this.dispatch('users.register', msg);
    });

    it('must be able to send challenge email', function test() {
      return requestChallenge.call(this)
        .reflect()
        .then(inspectPromise())
        .then((validation) => {
          expect(validation).to.have.ownProperty('context');
          expect(validation.queued).to.be.eq(true);
        });
    });

    it('must fail to send challenge email more than once in an hour per user', function test() {
      const msgRe = /^We've already sent you an email, if it doesn't come - please try again in (.*) or send us an email$/;
      return Promise.bind(this)
        .then(requestChallenge)
        .then(requestChallenge)
        .reflect()
        .then(inspectPromise(false))
        .then((validation) => {
          expect(validation.name).to.be.eq('HttpStatusError');
          expect(validation.statusCode).to.be.eq(429);
          expect(validation.message).to.be.match(msgRe);
        });
    });

    it('must fail to send challeng email during race condition', function test() {
      const msgRe = /^We've already sent you an email, if it doesn't come - please try again in (.*) or send us an email$/;
      return Promise
        .bind(this)
        .return([requestChallenge, requestChallenge, requestChallenge])
        .map((it) => it.call(this))
        .reflect()
        .then(inspectPromise(false))
        .then((validation) => {
          expect(validation.name).to.be.eq('HttpStatusError');
          expect(validation.statusCode).to.be.eq(429);
          expect(validation.message).to.be.match(msgRe);
        });
    });
  });
});

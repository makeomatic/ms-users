/* global inspectPromise */
const { expect } = require('chai');
const assert = require('assert');
const redisKey = require('../../src/utils/key.js');
const simpleDispatcher = require('./../helpers/simpleDispatcher');
const sinon = require('sinon');

describe('#requestPassword', function requestPasswordSuite() {
  const username = 'v@makeomatic.ru';
  const audience = 'requestPassword';
  const { USERS_BANNED_FLAG, USERS_ACTIVE_FLAG, USERS_DATA } = require('../../src/constants.js');

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function pretest() {
    this.dispatch = simpleDispatcher(this.users.router);
    return this.dispatch('users.register', {
      username,
      password: '123',
      audience,
      metadata: {
        rpass: true,
      },
    });
  });

  it('must fail when user does not exist', function test() {
    return this.dispatch('users.requestPassword', { username: 'noob' })
      .reflect()
      .then(inspectPromise(false))
      .then(requestPassword => {
        expect(requestPassword.name).to.be.eq('HttpStatusError');
        expect(requestPassword.statusCode).to.be.eq(404);
      });
  });

  describe('account: inactive', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(username, USERS_DATA), USERS_ACTIVE_FLAG, 'false');
    });

    it('must fail when account is inactive', function test() {
      return this.dispatch('users.requestPassword', { username })
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
      return this.users.redis.hset(redisKey(username, USERS_DATA), USERS_BANNED_FLAG, 'true');
    });

    it('must fail when account is banned', function test() {
      return this.dispatch('users.requestPassword', { username })
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
      return this.dispatch('users.requestPassword', { username })
        .reflect()
        .then(inspectPromise())
        .then(requestPassword => {
          expect(requestPassword).to.be.deep.eq({ success: true });
        });
    });

    it('must send challenge sms for an existing user with an active account', function test() {
      const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
      const username = '+79215555555';
      const registerParams = {
        username,
        password: '123',
        challengeType: 'phone',
        audience,
        metadata: {
          rpass: true,
        },
      };
      const requestPasswordParams = { username, challengeType: 'phone', wait: true };

      amqpStub.withArgs('phone.message.predefined')
        .returns(Promise.resolve({ queued: true }));

      return this.dispatch('users.register', registerParams)
        .then(() => this.dispatch('users.requestPassword', requestPasswordParams))
        .reflect()
        .then(inspectPromise())
        .then(requestPassword => {
          assert.equal(amqpStub.args.length, 1);

          const args = amqpStub.args[0];
          const action = args[0];
          const message = args[1];

          assert.equal(action, 'phone.message.predefined');
          assert.equal(message.account, 'twilio');
          assert.equal(/\d{4} is your password/.test(message.message), true);
          assert.equal(message.to, '+79215555555');
          assert.deepEqual(requestPassword, { success: true });

          amqpStub.restore();
        });
    });

    it('must reject sending reset password emails for an existing user more than once in 3 hours', function test() {
      return this.dispatch('users.requestPassword', { username })
        .then(() => (
          this.dispatch('users.requestPassword', { username })
            .reflect()
            .then(inspectPromise(false))
            .then(requestPassword => {
              expect(requestPassword.name).to.be.eq('HttpStatusError');
              expect(requestPassword.statusCode).to.be.eq(429);
            })
        ));
    });
  });
});

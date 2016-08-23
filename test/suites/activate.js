/* global inspectPromise */
const { expect } = require('chai');
const assert = require('assert');
const is = require('is');
const sinon = require('sinon');
const simpleDispatcher = require('../helpers/simpleDispatcher');

describe('#activate', function activateSuite() {
  const email = 'v@aminev.me';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function genToken() {
    this.dispatch = simpleDispatcher(this.users.router);

    return this
      .users.tokenManager.create({
        id: email,
        action: 'activate',
      })
      .tap(result => {
        this.token = result.secret;
      });
  });

  it('must reject activation when challenge token is invalid', function test() {
    const params = { token: 'useless-token' };
    return this.dispatch('users.activate', params)
      .reflect()
      .then(inspectPromise(false))
      .then(activation => {
        expect(activation.name).to.be.eq('HttpStatusError');
        expect(activation.statusCode).to.be.eq(403);
        expect(activation.message).to.match(/invalid token/);
      });
  });

  describe('activate existing user', function suite() {
    beforeEach(function pretest() {
      return this.dispatch('users.register', {
        username: email,
        password: '123',
        audience: 'ok',
        activate: true,
        metadata: {
          wolf: true,
        },
      });
    });

    it('must reject activation when account is already activated', function test() {
      const params = { token: this.token };
      return this.dispatch('users.activate', params)
        .reflect()
        .then(inspectPromise(false))
        .then(activation => {
          expect(activation.name).to.be.eq('HttpStatusError');
          expect(activation.message).to.match(/Account v@aminev\.me was already activated/);
          expect(activation.statusCode).to.be.eq(417);
        });
    });
  });

  describe('activate inactive user', function suite() {
    beforeEach(function pretest() {
      return this.dispatch('users.register', {
        username: email,
        password: '123',
        audience: 'ok',
        metadata: {
          wolf: true,
        },
        activate: false,
        skipChallenge: true,
      });
    });

    it('must activate account when challenge token is correct and not expired', function test() {
      return this.dispatch('users.activate', { token: this.token })
        .reflect()
        .then(inspectPromise());
    });
  });

  describe('activate inactive existing user', function suite() {
    beforeEach(function pretest() {
      const params = { username: 'v@makeomatic.ru', password: '123', audience: 'ok', metadata: { wolf: true }, activate: false };
      return this.dispatch('users.register', params);
    });

    it('must activate account when only username is specified as a service action', function test() {
      return this.dispatch('users.activate', {
        username: 'v@makeomatic.ru',
      })
      .reflect()
      .then(inspectPromise());
    });
  });

  it('must fail to activate account when only username is specified as a service action and the user does not exist', function test() {
    return this.dispatch('users.activate', { username: 'v@makeomatic.ru' })
      .reflect()
      .then(inspectPromise(false))
      .then(activation => {
        try {
          expect(activation.name).to.be.eq('HttpStatusError');
          expect(activation.statusCode).to.be.eq(404);
        } catch (e) {
          throw activation;
        }
      });
  });

  it('should be able to activate an account by sms', function test() {
    const opts = {
      activate: false,
      audience: '*.localhost',
      challengeType: 'phone',
      password: 'mynicepassword',
      username: '+79215555555',
      waitChallenge: true,
    };
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');

    amqpStub.withArgs('phone.message.predefined')
      .returns(Promise.resolve({ queued: true }));

    return simpleDispatcher(this.users.router)('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(value => {
        const message = amqpStub.args[0][1].message;
        const code = message.match(/^(\d{4}) is your activation code/)[1];

        amqpStub.restore();

        return code;
      })
      .bind(this)
      .then(code => this.dispatch('users.activate', { token: code, username: '+79215555555' }))
      .reflect()
      .then(inspectPromise())
      .then(response => {
        assert.equal(is.string(response.jwt), true);
        assert.equal(response.user.username, '+79215555555');
      });
  });
});

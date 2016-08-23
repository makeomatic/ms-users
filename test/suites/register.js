/* global inspectPromise */
const { expect } = require('chai');
const assert = require('assert');
const is = require('is');
const simpleDispatcher = require('./../helpers/simpleDispatcher');
const sinon = require('sinon');
const times = require('lodash/times');

describe('#register', function registerSuite() {
  beforeEach(global.startService);
  beforeEach('set dispatcher', function setDispatcher() {
    this.dispatch = simpleDispatcher(this.users.router);
  });
  afterEach(global.clearRedis);

  it('must reject invalid registration params and return detailed error', function test() {
    return this.dispatch('users.register', {})
      .reflect()
      .then(inspectPromise(false))
      .then(registered => {
        expect(registered.name).to.be.eq('ValidationError');
        expect(registered.errors).to.have.length.of(2);
      });
  });

  it('must be able to create user without validations and return user object and jwt token', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(true))
      .then(registered => {
        expect(registered).to.have.ownProperty('jwt');
        expect(registered).to.have.ownProperty('user');
        expect(registered.user.username).to.be.eq(opts.username);
        expect(registered.user).to.have.ownProperty('metadata');
        expect(registered.user.metadata).to.have.ownProperty('matic.ninja');
        expect(registered.user.metadata).to.have.ownProperty('*.localhost');
        expect(registered.user).to.not.have.ownProperty('password');
        expect(registered.user).to.not.have.ownProperty('audience');
      });
  });

  it('must be able to create user with alias', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      audience: 'matic.ninja',
      alias: 'bondthebest',
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(true))
      .then(registered => {
        expect(registered).to.have.ownProperty('jwt');
        expect(registered).to.have.ownProperty('user');
        expect(registered.user.username).to.be.eq(opts.username);
        expect(registered.user).to.have.ownProperty('metadata');
        expect(registered.user.metadata).to.have.ownProperty('matic.ninja');
        expect(registered.user.metadata).to.have.ownProperty('*.localhost');
        expect(registered.user.metadata['*.localhost'].alias).to.be.eq(opts.alias);
        expect(registered.user).to.not.have.ownProperty('password');
        expect(registered.user).to.not.have.ownProperty('audience');
      });
  });

  it('must be able to create user without validations and return user object and jwt token, password is auto-generated', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      audience: 'matic.ninja',
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(true))
      .then(registered => {
        expect(registered).to.have.ownProperty('jwt');
        expect(registered).to.have.ownProperty('user');
        expect(registered.user.username).to.be.eq(opts.username);
        expect(registered.user).to.have.ownProperty('metadata');
        expect(registered.user.metadata).to.have.ownProperty('matic.ninja');
        expect(registered.user.metadata).to.have.ownProperty('*.localhost');
        expect(registered.user).to.not.have.ownProperty('password');
        expect(registered.user).to.not.have.ownProperty('audience');
      });
  });

  it('must be able to create user with validation and return success', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      activate: false,
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(value => {
        expect(value).to.be.deep.eq({
          requiresActivation: true,
        });
      });
  });

  it('must be able to create user with generated password', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      audience: 'matic.ninja',
      activate: false,
      metadata: {
        wolf: true,
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(value => {
        expect(value).to.be.deep.eq({
          requiresActivation: true,
        });
      });
  });

  describe('consequent registrations', function suite() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      activate: false,
      metadata: {
        service: 'craft',
      },
    };

    beforeEach(function pretest() {
      return this.dispatch('users.register', opts);
    });

    it('must reject registration for an already existing user', function test() {
      return this.dispatch('users.register', opts)
        .reflect()
        .then(inspectPromise(false))
        .then(registered => {
          expect(registered.name).to.be.eq('HttpStatusError');
          expect(registered.statusCode).to.be.eq(409);
          expect(registered.message).to.match(/"v@makeomatic\.ru" already exists/);
        });
    });
  });

  describe('ipaddress limits', function suite() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      activate: false,
      ipaddress: '192.168.1.1',
      metadata: {
        service: 'craft',
      },
    };

    beforeEach(function pretest() {
      return Promise.all(
        times(3, n => this.dispatch('users.register', { ...opts, username: `${n + 1}${opts.username}` }))
      );
    });

    it('must reject more than 3 registration a day per ipaddress if it is specified', function test() {
      return this.dispatch('users.register', opts)
        .reflect()
        .then(inspectPromise(false))
        .then(failed => {
          expect(failed.name).to.be.eq('HttpStatusError');
          expect(failed.statusCode).to.be.eq(429);
          expect(failed.message).to.be.eq('You can\'t register more users from your ipaddress now');
        });
    });
  });

  it('must reject registration for disposable email addresses', function test() {
    const opts = {
      username: 'v@mailinator.com',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(false))
      .then(failed => {
        expect(failed.name).to.be.eq('HttpStatusError');
        expect(failed.statusCode).to.be.eq(400);
        expect(failed.message).to.be.eq('you must use non-disposable email to register');
      });
  });

  it('must reject registration for a domain name, which lacks MX record', function test() {
    const opts = {
      username: 'v@aminev.co',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(false))
      .then(failed => {
        expect(failed.name).to.be.eq('HttpStatusError');
        expect(failed.statusCode).to.be.eq(400);
        expect(failed.message).to.be.eq('no MX record was found for hostname aminev.co');
      });
  });

  describe('captcha', function suite() {
    it('must reject registration when captcha is specified and its invalid');
    it('must register user when captcha is specified and its valid');
  });

  it('must be able to send activation code by sms', function test() {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const opts = {
      activate: false,
      audience: '*.localhost',
      challengeType: 'phone',
      password: 'mynicepassword',
      username: '+79215555555',
    };

    amqpStub.withArgs('phone.message.predefined')
      .returns(Promise.resolve({ queued: true }));

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(value => {
        assert.equal(amqpStub.args.length, 1);

        const args = amqpStub.args[0];
        const action = args[0];
        const message = args[1];

        assert.equal(action, 'phone.message.predefined');
        assert.equal(message.account, 'twilio');
        assert.equal(/\d{4} is your activation code/.test(message.message), true);
        assert.equal(message.to, '+79215555555');
        assert.equal(value.requiresActivation, true);
        assert.equal(is.string(value.uid), true);

        amqpStub.restore();
      });
  });

  it('must be able to send password by sms', function test() {
    const amqpStub = sinon.stub(this.users.amqp, 'publishAndWait');
    const opts = {
      activate: true,
      audience: '*.localhost',
      challengeType: 'phone',
      username: '+79215555555',
    };

    amqpStub.withArgs('phone.message.predefined')
      .returns(Promise.resolve({ queued: true }));

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(value => {
        assert.equal(amqpStub.args.length, 1);

        const args = amqpStub.args[0];
        const action = args[0];
        const message = args[1];

        assert.equal(action, 'phone.message.predefined');
        assert.equal(message.account, 'twilio');
        assert.equal(/^.{10} is your password/.test(message.message), true);
        assert.equal(message.to, '+79215555555');
        assert.deepEqual(value.user.username, '+79215555555');

        amqpStub.restore();
      });
  });
});

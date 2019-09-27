/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const times = require('lodash/times');
const assert = require('assert');

describe('#register', function registerSuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject invalid registration params and return detailed error', function test() {
    return this.dispatch('users.register', {})
      .reflect()
      .then(inspectPromise(false))
      .then((registered) => {
        assert.equal(registered.name, 'HttpStatusError');
        assert.equal(registered.errors.length, 2);
      });
  });

  it('must be able to create user without validations and return user object and jwt token', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      skipPassword: true,
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(true))
      .then((registered) => {
        assert(registered.hasOwnProperty('jwt'));
        assert(registered.hasOwnProperty('user'));
        assert.ok(registered.user.id);
        assert(registered.user.hasOwnProperty('metadata'));
        assert(registered.user.metadata.hasOwnProperty('matic.ninja'));
        assert(registered.user.metadata.hasOwnProperty('*.localhost'));
        assert.equal(registered.user.metadata['*.localhost'].username, opts.username);
        assert.ifError(registered.user.password);
        assert.ifError(registered.user.audience);
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
      .then((registered) => {
        assert(registered.hasOwnProperty('jwt'));
        assert(registered.hasOwnProperty('user'));
        assert.ok(registered.user.id);
        assert(registered.user.hasOwnProperty('metadata'));
        assert(registered.user.metadata.hasOwnProperty('matic.ninja'));
        assert(registered.user.metadata.hasOwnProperty('*.localhost'));
        assert.equal(registered.user.metadata['*.localhost'].username, opts.username);
        assert.equal(registered.user.metadata['*.localhost'].alias, opts.alias);
        assert.ifError(registered.user.password);
        assert.ifError(registered.user.audience);
      });
  });

  describe('must reject creating user', function suite() {
    const opts = {
      username: 'v@makeomatic.ru',
      audience: 'matic.ninja',
      alias: 'bondthebest',
      metadata: {
        service: 'craft',
      },
    };

    beforeEach(function injectUser() {
      return this.dispatch('users.register', { ...opts });
    });

    it('with an already existing alias', function test() {
      return this.dispatch('users.register', {
        ...opts,
        username: 'test@makeomatic.ru',
      })
        .reflect()
        .then(inspectPromise(false))
        .then((error) => {
          assert.equal(error.message, `"${opts.alias}" already exists`);
          assert.equal(error.name, 'HttpStatusError');
          assert.equal(error.statusCode, 409);
        });
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
      .then((registered) => {
        assert(registered.hasOwnProperty('jwt'));
        assert(registered.hasOwnProperty('user'));
        assert.ok(registered.user.id);
        assert(registered.user.hasOwnProperty('metadata'));
        assert(registered.user.metadata.hasOwnProperty('matic.ninja'));
        assert(registered.user.metadata.hasOwnProperty('*.localhost'));
        assert.equal(registered.user.metadata['*.localhost'].username, opts.username);
        assert.ifError(registered.user.password);
        assert.ifError(registered.user.audience);
      });
  });

  it('must be able to create user with validation and return success', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword7159',
      audience: 'matic.ninja',
      activate: false,
      metadata: {
        service: 'craft',
      },
    };

    return this
      .dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then(({ requiresActivation, id }) => {
        assert.ok(id);
        assert.equal(requiresActivation, true);
      });
  });

  describe('must check password strength', function suite() {
    const weakPasswords = [
      'hello',
      'id1v@makeomatic.ru',
      'niceuser',
      'makeomatic',
      'NiceP@ssWord',
      'shortPwdSmpl',
      'ghbdtn',
      'asdf',
      'zxcvbnqwertyuiop',
      'asdf123Barbaz',
      'StrongPassword9',
      'p7a1s9a1',
    ];

    const goodPasswords = [
      'FooBas!@#asd',
      'p7a1s9a1levap791',
      'asdf123BarbazWordsFooPass',
    ];

    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      activate: true,
      metadata: {
        service: 'craft',
      },
    };

    it('weak passwords', async function test() {
      const promises = [];
      const { config } = this.users;
      const { passwordValidator: validatorConfig } = config;

      validatorConfig.enabled = true;

      weakPasswords.forEach((password, index) => {
        const reqOpts = { ...opts, username: `id${index}${opts.username}`, password };
        promises.push(this
          .dispatch('users.register', reqOpts)
          .reflect()
          .then(inspectPromise(false)));
      });

      const result = await Promise.all(promises);

      result.forEach((err) => {
        assert.equal(err.statusCode, 400);
      });
    });

    it('good passwords', async function test() {
      const promises = [];
      const { config } = this.users;
      const { passwordValidator: validatorConfig } = config;

      validatorConfig.enabled = true;

      goodPasswords.forEach((password, index) => {
        const reqOpts = { ...opts, username: `id${index}${opts.username}`, password };
        promises.push(this
          .dispatch('users.register', reqOpts)
          .reflect()
          .then(inspectPromise(true)));
      });

      const result = await Promise.all(promises);
      result.forEach(({ user }) => {
        assert.ok(user.id);
      });
    });
  });

  it('force password check', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: '',
      checkPassword: true,
      audience: 'matic.ninja',
      activate: true,
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(false));
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
      .then(({ requiresActivation, id }) => {
        assert.ok(id);
        assert.equal(requiresActivation, true);
      });
  });

  describe('consequent registrations', function suite() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword7159',
      audience: 'matic.ninja',
      activate: false,
      metadata: {
        service: 'craft',
      },
    };

    beforeEach(function pretest() {
      return this.dispatch('users.register', { ...opts });
    });

    it('must reject registration for an already existing user', function test() {
      return this.dispatch('users.register', opts)
        .reflect()
        .then(inspectPromise(false))
        .then((registered) => {
          assert.equal(registered.name, 'HttpStatusError');
          assert.equal(registered.statusCode, 409);
          assert(/user already exists/.test(registered.message));
        });
    });
  });

  describe('ipaddress limits', function suite() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword7159',
      audience: 'matic.ninja',
      activate: false,
      ipaddress: '192.168.1.1',
      metadata: {
        service: 'craft',
      },
    };

    beforeEach(function pretest() {
      return Promise.all(times(3, (n) => (
        this.dispatch('users.register', { ...opts, username: `${n + 1}${opts.username}` })
      )));
    });

    it('must reject more than 3 registration a day per ipaddress if it is specified', function test() {
      return this.dispatch('users.register', opts)
        .reflect()
        .then(inspectPromise(false))
        .then((failed) => {
          assert.equal(failed.name, 'HttpStatusError');
          assert.equal(failed.statusCode, 429);
          assert.equal(failed.message, 'You can\'t register more users from your ipaddress \'192.168.1.1\' now');
        });
    });
  });

  it('must reject registration for disposable email addresses', function test() {
    const opts = {
      username: 'v@mailinator.com',
      password: 'mynicepassword7159',
      audience: 'matic.ninja',
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((failed) => {
        assert.equal(failed.name, 'HttpStatusError');
        assert.equal(failed.statusCode, 400);
        assert.equal(failed.message, 'you must use non-disposable email to register');
      });
  });

  it('must reject registration for a domain name, which lacks MX record', function test() {
    const opts = {
      username: 'v@aminev.co',
      password: 'mynicepassword7159',
      audience: 'matic.ninja',
      metadata: {
        service: 'craft',
      },
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise(false))
      .then((failed) => {
        assert.equal(failed.name, 'HttpStatusError');
        assert.equal(failed.statusCode, 400);
        assert.equal(failed.message, 'no MX record was found for hostname aminev.co');
      });
  });

  describe('captcha', function suite() {
    it('must reject registration when captcha is specified and its invalid');
    it('must register user when captcha is specified and its valid');
  });
});

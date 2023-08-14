/* eslint-disable no-prototype-builtins */
const Promise = require('bluebird');
const times = require('lodash/times');
const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../config');

describe('#register', function registerSuite() {
  describe('password validator disabled', function testSuite() {
    beforeEach(startService);
    afterEach(clearRedis);

    it('must reject invalid registration params and return detailed error', async function test() {
      await assert.rejects(this.users.dispatch('register', { params: {} }), (err) => {
        assert.equal(err.name, 'HttpStatusError');
        assert.equal(err.errors.length, 2);
        return true;
      });
    });

    it('must be able to create user without validations and return user object and jwt token', async function test() {
      const opts = {
        username: 'v@makeomatic.ru',
        password: 'mynicepassword',
        audience: 'matic.ninja',
        skipPassword: true,
        metadata: {
          service: 'craft',
        },
      };

      const registered = await this.users.dispatch('register', { params: opts });

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

    it('must be able to create user with alias', function test() {
      const opts = {
        username: 'v@makeomatic.ru',
        audience: 'matic.ninja',
        alias: 'bondthebest',
        metadata: {
          service: 'craft',
        },
      };

      return this.users.dispatch('register', { params: opts })
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
        return this.users.dispatch('register', { params: { ...opts } });
      });

      it('with an already existing alias', async function test() {
        await assert.rejects(this.users.dispatch('register', { params: {
          ...opts,
          username: 'test@makeomatic.ru',
        } }), (error) => {
          assert.equal(error.message, `"${opts.alias}" already exists`);
          assert.equal(error.name, 'HttpStatusError');
          assert.equal(error.statusCode, 409);
          return true;
        });
      });
    });

    it('must be able to create user without validations and return user object and jwt token, password is auto-generated', async function test() {
      const opts = {
        username: 'v@makeomatic.ru',
        audience: 'matic.ninja',
        metadata: {
          service: 'craft',
        },
      };

      const registered = await this.users.dispatch('register', { params: opts });

      console.info('%j', registered);

      assert(registered.hasOwnProperty('jwt'));
      assert(registered.hasOwnProperty('user'));

      assert.ok(registered.user.id);
      assert(registered.user.hasOwnProperty('metadata'));

      // 2 audiences
      assert(registered.user.metadata.hasOwnProperty('matic.ninja'));
      assert(registered.user.metadata.hasOwnProperty('*.localhost'));

      // verify that default props were set
      assert.equal(registered.user.metadata['*.localhost'].username, opts.username);
      assert.ok(/^\d+$/.test(registered.user.metadata['*.localhost'].aa));

      // must not be present
      assert.ifError(registered.user.password);
      assert.ifError(registered.user.audience);
    });

    it('must be able to create user with validation and return success', async function test() {
      const opts = {
        username: 'v@makeomatic.ru',
        password: 'mynicepassword7159',
        audience: 'matic.ninja',
        activate: false,
        metadata: {
          service: 'craft',
        },
      };

      const { requiresActivation, id } = await this.users.dispatch('register', { params: opts });

      assert.ok(id);
      assert.equal(requiresActivation, true);
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
        return this.users.dispatch('register', { params: { ...opts } });
      });

      it('must reject registration for an already existing user', async function test() {
        await assert.rejects(this.users.dispatch('register', { params: opts }), (registered) => {
          assert.equal(registered.name, 'HttpStatusError');
          assert.equal(registered.statusCode, 409);
          assert(/user already exists/.test(registered.message));
          return true;
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
          this.users.dispatch('register', { params: { ...opts, username: `${n + 1}${opts.username}` } })
        )));
      });

      it('must reject more than 3 registration a day per ipaddress if it is specified', async function test() {
        await assert.rejects(this.users.dispatch('register', { params: opts }), (failed) => {
          assert.equal(failed.name, 'HttpStatusError');
          assert.equal(failed.statusCode, 429);
          assert.equal(failed.message, 'You can\'t register more users from your ipaddress \'192.168.1.1\' now');
          return true;
        });
      });
    });

    it('must reject registration for disposable email addresses', async function test() {
      const opts = {
        username: 'v@mailinator.com',
        password: 'mynicepassword7159',
        audience: 'matic.ninja',
        metadata: {
          service: 'craft',
        },
      };

      await assert.rejects(this.users.dispatch('register', { params: opts }), (failed) => {
        assert.equal(failed.name, 'HttpStatusError');
        assert.equal(failed.statusCode, 400);
        assert.equal(failed.message, 'you must use non-disposable email to register');
        return true;
      });
    });

    it('must reject registration for a domain name, which lacks MX record', async function test() {
      const opts = {
        username: 'v@aminev.co',
        password: 'mynicepassword7159',
        audience: 'matic.ninja',
        activate: false,
        metadata: {
          service: 'craft',
        },
      };

      await assert.rejects(this.users.dispatch('register', { params: opts }), (failed) => {
        assert.equal(failed.name, 'HttpStatusError');
        assert.equal(failed.statusCode, 400);
        assert.equal(failed.message, 'no MX record was found for hostname aminev.co');
        return true;
      });
    });

    it('force password check', async function test() {
      const msg = {
        username: 'v@makeomatic.ru',
        password: '',
        checkPassword: true,
        audience: 'matic.ninja',
        activate: true,
        metadata: {
          service: 'craft',
        },
      };

      await assert.rejects(this.users.dispatch('register', { params: msg }));
    });
  });

  describe('password validator enabled', function testSuite() {
    beforeEach(async function start() {
      await startService.call(this, {
        passwordValidator: { enabled: true },
      });
    });

    afterEach(clearRedis);

    it('must be able to create user without password validations and return user object and jwt token', function test() {
      const opts = {
        username: 'v@makeomatic.ru',
        password: 'mynicepassword',
        audience: 'matic.ninja',
        skipPassword: true,
        metadata: {
          service: 'craft',
        },
      };

      return this.users.dispatch('register', { params: opts })
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

    it('must be able to create user without validations and return user object and jwt token, password is auto-generated', function test() {
      const opts = {
        username: 'v@makeomatic.ru',
        audience: 'matic.ninja',
        metadata: {
          service: 'craft',
        },
      };

      return this.users.dispatch('register', { params: opts })
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
  });

  describe('validator skip/force check & config schema', function suite() {
    describe('skip check', function skipCheckSuite() {
      beforeEach(async function start() {
        await startService.call(this, {
          passwordValidator: {
            enabled: true,
            skipCheckFieldNames: ['skipPassword'],
          },
        });
      });

      it('skips validation if field exists', async function test() {
        const opts = {
          username: 'v@makeomatic.ru',
          password: 'mynicepassword',
          audience: 'matic.ninja',
          skipPassword: true,
        };

        const result = await this.users.dispatch('register', { params: opts });
        assert(result.hasOwnProperty('jwt'));
      });

      afterEach(clearRedis);
    });

    describe('config forceCheckFieldNames/skipCheckFieldNames check', function skipForceSuite() {
      it('forceCheckFieldNames', async function test() {
        await assert.rejects(startService.call(this, {
          passwordValidator: {
            enabled: true,
            forceCheckFieldNames: null,
          },
        }), {
          name: 'HttpStatusError',
          status: 400,
          message: '[@microfleet/core] Could not attach validator:\n'
            + 'config validation failed: data/passwordValidator/forceCheckFieldNames must be array',
        });
      });

      it('skipCheckFieldNames', async function test() {
        await assert.rejects(startService.call(this, {
          passwordValidator: {
            enabled: true,
            skipCheckFieldNames: null,
          },
        }), {
          name: 'HttpStatusError',
          status: 400,
          message: '[@microfleet/core] Could not attach validator:\n'
            + 'config validation failed: data/passwordValidator/skipCheckFieldNames must be array',
        });
      });
    });

    describe('force check', function forceCheckTest() {
      beforeEach(async function start() {
        await startService.call(this, {
          passwordValidator: {
            enabled: false,
            forceCheckFieldNames: ['forceCheck', 'fieldIsMissing'],
          },
        });
      });
      afterEach(clearRedis);

      it('forces validation if field exists', async function test() {
        const opts = {
          username: 'v@makeomatic.ru',
          password: 'mynicepassword',
          audience: 'matic.ninja',
          forceCheck: true,
        };
        let err;

        try {
          await this.users.dispatch('register', { params: opts });
        } catch (e) {
          err = e;
        }

        assert(err.status === 400, 'Must be HttpStatusError');
        assert.equal(err.message, 'register validation failed: data/password failed complexity check');
      });
    });
  });

  describe('must check password strength', function suite() {
    beforeEach(async function start() {
      await startService.call(this, {
        passwordValidator: { enabled: true },
      });
    });
    afterEach(clearRedis);

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

      weakPasswords.forEach((password, index) => {
        const reqOpts = { ...opts, username: `id${index}${opts.username}`, password };
        promises.push(assert.rejects(this.users.dispatch('register', { params: reqOpts }), {
          statusCode: 400,
        }));
      });

      await Promise.all(promises);
    });

    it('good passwords', async function test() {
      const promises = [];

      goodPasswords.forEach((password, index) => {
        const reqOpts = { ...opts, username: `id${index}${opts.username}`, password };
        promises.push(this.users.dispatch('register', { params: reqOpts }));
      });

      const result = await Promise.all(promises);
      result.forEach(({ user }) => {
        assert.ok(user.id);
      });
    });

    it('must be able to create user with generated password', async function test() {
      const msg = {
        username: 'v@makeomatic.ru',
        audience: 'matic.ninja',
        activate: false,
        metadata: {
          wolf: true,
        },
      };

      const { requiresActivation, id } = await this.users.dispatch('register', { params: msg });

      assert.ok(id);
      assert.equal(requiresActivation, true);
    });
  });

  describe('captcha', function suite() {
    it('must reject registration when captcha is specified and its invalid');
    it('must register user when captcha is specified and its valid');
  });
});

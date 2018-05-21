/* global globalRegisterUser, globalAuthUser */
const crypto = require('crypto');
const assert = require('assert');
const { inspectPromise } = require('@makeomatic/deploy');
const authenticator = require('otplib/authenticator');

authenticator.options = { crypto };

describe('#2fa.*', function activateSuite() {
  // actions supported by this
  const username = '2fa@me.com';
  const generateRoute = 'users.2fa.generate-key';
  const attachRoute = 'users.2fa.attach';
  const verifyRoute = 'users.2fa.verify';
  const regenerateRoute = 'users.2fa.regenerate-codes';
  const detachRoute = 'users.2fa.detach';

  before(global.startService);
  after(global.clearRedis);

  // registers user and pushes JWT to this.jwt
  before('register user', globalRegisterUser(username));
  before('auth user', globalAuthUser(username));

  let secret;
  let recoveryCodes;
  let regeneratedCodes;

  describe('#2fa.generate-key', function generateKeySuite() {
    it('generates key', function test() {
      return this
        .dispatch(generateRoute, { username })
        .reflect()
        .then(inspectPromise())
        .then(({ secret: secretKey }) => {
          // check if valid secret is returned

          // save secret for attaching
          secret = secretKey;
        });
    });
  });

  describe('#2fa.attach', function attachSuite() {
    it('doesn\'t allow to attach if provided totp is invalid', function test() {
      return this.dispatch(attachRoute, { username, secret, totp: '123456' })
        .reflect()
        .then(inspectPromise(false))
        .then((res) => {
          assert.equal(res.name, 'NotPermittedError');
          assert.equal(res.args[0].name, 'HttpStatusError');
          assert.equal(res.args[0].statusCode, 403);
        });
    });

    it('attaches secret to user account if provided totp is valid', function test() {
      return this.dispatch(attachRoute, { username, secret, totp: authenticator.generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(({ enabled, recoveryCodes: codes }) => {
          assert.ok(enabled);
          assert.equal(codes.length, 10);

          // store for future use
          recoveryCodes = codes;
        });
    });

    it('doesn\'t allow to attach if already attached', function test() {
      return this.dispatch(attachRoute, { username, secret, totp: authenticator.generate(secret) })
        .reflect()
        .then(inspectPromise(false))
        .then((res) => {
          assert.equal(res.name, 'NotPermittedError');
          assert.equal(res.args[0].name, 'HttpStatusError');
          assert.equal(res.args[0].statusCode, 409);
        });
    });
  });

  describe('#2fa.verify', function verifySuite() {
    it('throws if invalid totp is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: '123456' })
        .reflect()
        .then(inspectPromise(false))
        .then((res) => {
          assert.equal(res.name, 'NotPermittedError');
          assert.equal(res.args[0].name, 'HttpStatusError');
          assert.equal(res.args[0].statusCode, 403);
        });
    });

    it('doesn\'t throw if valid totp is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: authenticator.generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(({ valid }) => {
          assert.ok(valid);
        });
    });

    it('doesn\'t throw if valid recovery code is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: recoveryCodes[0] })
        .reflect()
        .then(inspectPromise())
        .then(({ valid }) => {
          assert.ok(valid);
        });
    });

    it('throws if same recovery code provided one more time', function test() {
      return this.dispatch(verifyRoute, { username, totp: recoveryCodes[0] })
        .reflect()
        .then(inspectPromise(false))
        .then((res) => {
          assert.equal(res.name, 'NotPermittedError');
          assert.equal(res.args[0].name, 'HttpStatusError');
          assert.equal(res.args[0].statusCode, 403);

          // finally remove used code
          recoveryCodes = recoveryCodes.slice(1);
        });
    });
  });

  describe('#2fa.regenerate-codes', function regenerateSuite() {
    it('doesn\'t allow to regenerate codes if invalid totp is provided', function test() {
      return this.dispatch(regenerateRoute, { username, totp: '123456' })
        .reflect()
        .then(inspectPromise(false))
        .then((res) => {
          assert.equal(res.name, 'NotPermittedError');
          assert.equal(res.args[0].name, 'HttpStatusError');
          assert.equal(res.args[0].statusCode, 403);
        });
    });

    it('allows to regenerate codes if valid totp is provided', function test() {
      return this.dispatch(regenerateRoute, { username, totp: authenticator.generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(({ regenerated, recoveryCodes: codes }) => {
          assert.ok(regenerated);
          assert.equal(codes.length, 10);

          // store new codes
          regeneratedCodes = codes;
        });
    });

    it('throws if some old recovery code is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: recoveryCodes[0] })
        .reflect()
        .then(inspectPromise(false))
        .then((res) => {
          assert.equal(res.name, 'NotPermittedError');
          assert.equal(res.args[0].name, 'HttpStatusError');
          assert.equal(res.args[0].statusCode, 403);
        });
    });

    it('doesn\'t throw if new valid recovery is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: regeneratedCodes[0] })
        .reflect()
        .then(inspectPromise())
        .then(({ valid }) => {
          assert.ok(valid);

          // remove used code
          regeneratedCodes = regeneratedCodes.slice(1);
        });
    });
  });

  describe('#2fa.detach', function detachSuite() {
    it('doesn\'t allow to detach if invalid totp is provided', function test() {
      return this.dispatch(detachRoute, { username, totp: '123456' })
        .reflect()
        .then(inspectPromise(false))
        .then((res) => {
          assert.equal(res.name, 'NotPermittedError');
          assert.equal(res.args[0].name, 'HttpStatusError');
          assert.equal(res.args[0].statusCode, 403);
        });
    });

    it('allows to detach if valid totp is provided', function test() {
      return this.dispatch(detachRoute, { username, totp: authenticator.generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(({ enabled }) => {
          assert.equal(enabled, false);
        });
    });

    it('doesn\'t allow to detach if not attached', function test() {
      return this.dispatch(detachRoute, { username, totp: authenticator.generate(secret) })
        .reflect()
        .then(inspectPromise(false))
        .then((res) => {
          assert.equal(res.name, 'NotPermittedError');
          assert.equal(res.args[0].name, 'HttpStatusError');
          assert.equal(res.args[0].statusCode, 412);
        });
    });
  });
});

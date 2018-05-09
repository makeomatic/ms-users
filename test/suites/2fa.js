/* global globalRegisterUser, globalAuthUser */
const { inspectPromise } = require('@makeomatic/deploy');
const { generate } = require('otplib/authenticator');

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
        .dispatch(generateRoute)
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
      return this.dispatch(attachRoute, { username, secret, totp: 'invalid' })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });

    it('attaches secret to user account if provided totp is valid', function test() {
      return this.dispatch(attachRoute, { username, secret, totp: generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(({ recoveryCodes: codes }) => {
          // pass

          // store for future use
          recoveryCodes = codes;
        });
    });

    it('doesn\'t allow to attach if already attached', function test() {
      return this.dispatch(attachRoute, { username, secret })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });
  });

  describe('#2fa.verify', function verifySuite() {
    it('throws if invalid totp is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: 'invalid' })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });

    it('doesn\'t throw if valid totp is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });

    it('doesn\'t throw if valid recovery code is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: recoveryCodes[0] })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });

    it('throws if same recovery code provided one more time', function test() {
      return this.dispatch(verifyRoute, { username, totp: recoveryCodes[0] })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass

          // finally remove used code
          recoveryCodes = recoveryCodes.slice(1);
        });
    });
  });

  describe('#2fa.regenerate-codes', function regenerateSuite() {
    it('doesn\'t allow to regenerate codes if invalid totp is provided', function test() {
      return this.dispatch(regenerateRoute, { username, totp: 'invalid' })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });

    it('allows to regenerate codes if valid totp is provided', function test() {
      return this.dispatch(regenerateRoute, { username, totp: generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(({ recoveryCodes: codes }) => {
          // pass

          // store new codes
          regeneratedCodes = codes;
        });
    });

    it('throws if some old recovery code is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: recoveryCodes[0] })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });

    it('doesn\'t throw if valid recovery is provided', function test() {
      return this.dispatch(verifyRoute, { username, totp: regeneratedCodes[0] })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass

          // remove used code
          regeneratedCodes = regeneratedCodes.slice(1);
        });
    });
  });

  describe('#2fa.detach', function detachSuite() {
    it('doesn\'t allow to detach if invalid totp is provided', function test() {
      return this.dispatch(detachRoute, { username, totp: 'invalid' })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });

    it('allows to detach if valid totp is provided', function test() {
      return this.dispatch(detachRoute, { username, totp: generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });

    it('doesn\'t allow to detach if not attached', function test() {
      return this.dispatch(detachRoute, { username, totp: generate(secret) })
        .reflect()
        .then(inspectPromise())
        .then(() => {
          // pass
        });
    });
  });
});

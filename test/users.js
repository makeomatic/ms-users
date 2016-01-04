const URLSafeBase64 = require('urlsafe-base64');
const Promise = require('bluebird');
const chai = require('chai');
const { expect } = chai;
const Errors = require('common-errors');
const ld = require('lodash');

// make sure we have stack
chai.config.includeStack = true;

const config = {
  amqp: global.AMQP,
  redis: global.REDIS,
  validation: {
    templates: {
      activate: 'cappasity-activate',
      password: 'cappasity-password',
    },
  },
  registrationLimits: {
    ip: {
      times: 3,
      time: 3600000,
    },
    noDisposable: true,
    checkMX: true,
  },
};

function inspectPromise(mustBeFulfilled = true) {
  return function inspection(promise) {
    const isFulfilled = promise.isFulfilled();
    const isRejected = promise.isRejected();

    try {
      expect(isFulfilled).to.be.eq(mustBeFulfilled);
    } catch (e) {
      if (isFulfilled) {
        return Promise.reject(new Error(JSON.stringify(promise.value())));
      }

      throw promise.reason();
    }

    expect(isRejected).to.be.eq(!mustBeFulfilled);
    return mustBeFulfilled ? promise.value() : promise.reason();
  };
}

describe('Users suite', function UserClassSuite() {
  const Users = require('../src');
  const redisKey = require('../src/utils/key.js');

  describe('configuration suite', function ConfigurationSuite() {
    it('must throw on invalid configuration', function test() {
      expect(function throwOnInvalidConfiguration() {
        return new Users();
      }).to.throw(Errors.ValidationError);
    });

    it('must be able to initialize and close service', function test() {
      const users = new Users(config);
      return users.connect().tap(() => {
        return users.close();
      });
    });
  });

  describe('integration tests', function UnitSuite() {
    beforeEach(function startService() {
      this.users = new Users(config);
      this.users.on('plugin:connect:amqp', () => {
        this.users._mailer = { send: () => Promise.resolve() };
      });

      return this.users.connect();
    });

    afterEach(function clearRedis() {
      const nodes = this.users._redis.masterNodes;
      return Promise.map(Object.keys(nodes), nodeKey => {
        return nodes[nodeKey].flushdb();
      })
      .finally(() => {
        return this.users.close();
      })
      .finally(() => {
        this.users = null;
      });
    });

    describe('encrypt/decrypt suite', function cryptoSuite() {
      const emailValidation = require('../src/utils/send-email.js');

      it('must be able to encode and then decode token', function test() {
        const { algorithm, secret } = this.users._config.validation;
        const obj = { email: 'v@example.com', secret: 'super-secret' };
        const message = new Buffer(JSON.stringify(obj));
        const token = emailValidation.encrypt(algorithm, secret, message);
        expect(token).to.not.be.equal(JSON.stringify(obj));
        const decrypted = emailValidation.decrypt(algorithm, secret, token);
        expect(decrypted.toString()).to.be.eq(JSON.stringify(obj));
        expect(JSON.parse(decrypted)).to.be.deep.eq(obj);
      });
    });

    describe('#register', function registerSuite() {
      const headers = { routingKey: 'users.register' };

      it('must reject invalid registration params and return detailed error', function test() {
        return this.users.router({}, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(registered => {
            expect(registered.name).to.be.eq('ValidationError');
            expect(registered.errors).to.have.length.of(3);
          });
      });

      it('must be able to create user without validations and return user object and jwt token', function test() {
        const opts = {
          username: 'v@makeomatic.ru',
          password: 'mynicepassword',
          audience: 'matic.ninja',
        };

        return this.users
          .router(opts, headers)
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
        };

        return this.users.router(opts, headers)
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
        };

        beforeEach(function pretest() {
          return this.users.router(opts, headers);
        });

        it('must reject registration for an already existing user', function test() {
          return this.users.router(opts, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(registered => {
              expect(registered.name).to.be.eq('HttpStatusError');
              expect(registered.statusCode).to.be.eq(403);
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
        };

        beforeEach(function pretest() {
          return Promise.join(
            this.users.router({ ...opts, username: '1' + opts.username }, headers),
            this.users.router({ ...opts, username: '2' + opts.username }, headers),
            this.users.router({ ...opts, username: '3' + opts.username }, headers)
          );
        });

        it('must reject more than 3 registration a day per ipaddress if it is specified', function test() {
          return this.users.router(opts, headers)
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
        };

        return this.users.router(opts, headers)
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
        };

        return this.users.router(opts, headers)
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
    });

    describe('#challenge', function challengeSuite() {
      const headers = { routingKey: 'users.challenge' };

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
              expect(validation.statusCode).to.be.eq(412);
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

    describe('#activate', function activateSuite() {
      const headers = { routingKey: 'users.activate' };
      const emailValidation = require('../src/utils/send-email.js');
      const email = 'v@aminev.me';

      beforeEach(function genToken() {
        const { algorithm, secret } = this.users._config.validation;
        const token = this.uuid = 'incredible-secret';
        this.token = URLSafeBase64.encode(emailValidation.encrypt(algorithm, secret, new Buffer(JSON.stringify({ email, token }))));
      });

      it('must reject activation when challenge token is invalid', function test() {
        return this.users.router({ token: 'useless-token', namespace: 'activate' }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(activation => {
            expect(activation.name).to.be.eq('HttpStatusError');
            expect(activation.statusCode).to.be.eq(403);
            expect(activation.message).to.match(/could not decode token/);
          });
      });

      it('must reject activation when challenge token is expired or not found', function test() {
        return this.users.router({ token: this.token, namespace: 'activate' }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(activation => {
            expect(activation.name).to.be.eq('HttpStatusError');
            expect(activation.statusCode).to.be.eq(404);
          });
      });

      describe('activate existing user', function suite() {
        beforeEach(function pretest() {
          return this.users.router({ username: email, password: '123', audience: 'ok' }, { routingKey: 'users.register' });
        });

        beforeEach(function pretest() {
          const secretKey = redisKey('vsecret-activate', this.uuid);
          return this.users.redis.set(secretKey, email);
        });

        it('must reject activation when account is already activated', function test() {
          return this.users.router({ token: this.token, namespace: 'activate' }, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(activation => {
              expect(activation.name).to.be.eq('HttpStatusError');
              expect(activation.message).to.match(/Account v@aminev\.me was already activated/);
              expect(activation.statusCode).to.be.eq(413);
            });
        });
      });

      describe('activate inactive user', function suite() {
        beforeEach(function pretest() {
          return this.users.router({ username: email, password: '123', audience: 'ok', activate: false }, { routingKey: 'users.register' });
        });

        beforeEach('insert token', function pretest() {
          const secretKey = redisKey('vsecret-activate', this.uuid);
          return this.users.redis.set(secretKey, email);
        });

        it('must activate account when challenge token is correct and not expired', function test() {
          return this.users.router({ token: this.token, namespace: 'activate' }, headers)
            .reflect()
            .then(inspectPromise());
        });
      });

      describe('activate inactive existing user', function suite() {
        beforeEach(function pretest() {
          return this.users.router({ username: 'v@makeomatic.ru', password: '123', audience: 'ok', activate: false }, { routingKey: 'users.register' });
        });

        it('must activate account when only username is specified as a service action', function test() {
          return this.users.router({ username: 'v@makeomatic.ru' }, headers)
            .reflect()
            .then(inspectPromise());
        });
      });

      it('must fail to activate account when only username is specified as a service action and the user does not exist', function test() {
        return this.users.router({ username: 'v@makeomatic.ru' }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(activation => {
            expect(activation.name).to.be.eq('HttpStatusError');
            expect(activation.statusCode).to.be.eq(404);
            expect(activation.message).to.be.eq('user does not exist');
          });
      });
    });

    describe('#login', function loginSuite() {
      const headers = { routingKey: 'users.login' };
      const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
      const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };
      const scrypt = require('../src/utils/scrypt.js');

      before(function test() {
        return scrypt.hash(userWithValidPassword.password).then(pass => {
          this.password = pass;
        });
      });

      it('must reject login on a non-existing username', function test() {
        return this.users.router(user, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(login => {
            expect(login.name).to.be.eq('HttpStatusError');
            expect(login.statusCode).to.be.eq(404);
          });
      });

      describe('existing user: inactivate', function userSuite() {
        beforeEach(function pretest() {
          return this.users.router({ ...userWithValidPassword, activate: false }, { routingKey: 'users.register' });
        });

        it('must reject login on an inactive account', function test() {
          return this.users.router(userWithValidPassword, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(login => {
              expect(login.name).to.be.eq('HttpStatusError');
              expect(login.statusCode).to.be.eq(412);
            });
        });
      });

      describe('existing user: active', function userSuite() {
        beforeEach(function pretest() {
          return this.users.router(userWithValidPassword, { routingKey: 'users.register' });
        });

        it('must reject login on an invalid password', function test() {
          return this.users.router(user, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(login => {
              expect(login.name).to.be.eq('HttpStatusError');
              expect(login.statusCode).to.be.eq(403);
            });
        });

        describe('must reject login on a banned account', function suite() {
          beforeEach(function pretest() {
            return this.users.redis.hset(redisKey(user.username, 'data'), 'banned', 'true');
          });

          it(':', function test() {
            return this.users.router(userWithValidPassword, headers)
              .reflect()
              .then(inspectPromise(false))
              .then(login => {
                expect(login.name).to.be.eq('HttpStatusError');
                expect(login.statusCode).to.be.eq(423);
              });
          });
        });

        it('must login on a valid account with correct credentials', function test() {
          return this.users.router(userWithValidPassword, headers)
            .reflect()
            .then(inspectPromise());
        });

        it('must lock account for authentication after 5 invalid login attemps', function test() {
          const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
          const promises = [];

          ld.times(5, () => {
            promises.push(
              this.users.router(userWithRemoteIP, headers)
                .reflect()
                .then(inspectPromise(false))
                .then(login => {
                  expect(login.name).to.be.eq('HttpStatusError');
                  expect(login.statusCode).to.be.eq(403);
                })
            );
          });

          promises.push(
            this.users.router(userWithRemoteIP, headers)
              .reflect()
              .then(inspectPromise(false))
              .then(login => {
                expect(login.name).to.be.eq('HttpStatusError');
                expect(login.statusCode).to.be.eq(429);
              })
          );

          return Promise.all(promises);
        });
      });
    });

    describe('#logout', function logoutSuite() {
      const headers = { routingKey: 'users.logout' };

      it('must reject logout on an invalid JWT token', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;

        return this.users.router({ jwt: 'tests', audience }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(logout => {
            expect(logout.name).to.be.eq('HttpStatusError');
            expect(logout.statusCode).to.be.eq(403);
          });
      });

      it('must delete JWT token from pool of valid tokens', function test() {
        const jwt = require('jsonwebtoken');
        const { hashingFunction: algorithm, secret, issuer, defaultAudience } = this.users._config.jwt;
        const token = jwt.sign({ username: 'vitaly' }, secret, { algorithm, audience: defaultAudience, issuer });

        return this.users.router({ jwt: token, audience: defaultAudience }, headers)
          .reflect()
          .then(inspectPromise())
          .then(logout => {
            expect(logout).to.be.deep.eq({ success: true });
          });
      });
    });

    describe('#verify', function verifySuite() {
      const headers = { routingKey: 'users.verify' };

      it('must reject on an invalid JWT token', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;

        return this.users.router({ token: 'invalid-token', audience }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(verify => {
            expect(verify.name).to.be.eq('HttpStatusError');
            expect(verify.statusCode).to.be.eq(403);
            expect(verify.message).to.be.eq('invalid token');
          });
      });

      it('must reject on an expired JWT token', function test() {
        const jwt = require('jsonwebtoken');
        const { hashingFunction: algorithm, secret, issuer, defaultAudience } = this.users._config.jwt;
        const token = jwt.sign({ username: 'vitaly' }, secret, { algorithm, audience: defaultAudience, issuer });

        return this.users.router({ token, audience: defaultAudience }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(verify => {
            expect(verify.name).to.be.eq('HttpStatusError');
            expect(verify.statusCode).to.be.eq(403);
            expect(verify.message).to.be.eq('token has expired or was forged');
          });
      });

      describe('valid token', function suite() {
        const jwt = require('../src/utils/jwt.js');

        beforeEach(function pretest() {
          return this.users.router({ username: 'v@makeomatic.ru', password: '123', audience: 'test' }, { routingKey: 'users.register' });
        });

        beforeEach(function pretest() {
          return jwt.login.call(this.users, 'v@makeomatic.ru', 'test').then(data => {
            this.token = data.jwt;
          });
        });

        it('must return user object and required audiences information on a valid JWT token', function test() {
          return this.users.router({ token: this.token, audience: 'test' }, headers)
            .reflect()
            .then(inspectPromise())
            .then(verify => {
              expect(verify).to.be.deep.eq({
                username: 'v@makeomatic.ru',
                metadata: {
                  '*.localhost': {},
                  test: {},
                },
              });
            });
        });
      });
    });

    describe('#getMetadata', function getMetadataSuite() {
      const headers = { routingKey: 'users.getMetadata' };

      it('must reject to return metadata on a non-existing username', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;

        return this.users.router({ username: 'noob', audience }, headers)
          .reflect()
          .then(getMetadata => {
            expect(getMetadata.isRejected()).to.be.eq(true);
            expect(getMetadata.reason().name).to.be.eq('HttpStatusError');
            expect(getMetadata.reason().statusCode).to.be.eq(404);
          });
      });

      describe('existing user', function suite() {
        const username = 'v@makeomatic.ru';
        const audience = '*.localhost';

        beforeEach(function pretest() {
          return this.users.router({ username, password: '123', audience, metadata: { name: { q: 'verynicedata' } } }, { routingKey: 'users.register' });
        });

        beforeEach(function pretest() {
          return this.users.router({ username, audience: 'matic.ninja', metadata: { $set: { iat: 10 } } }, { routingKey: 'users.updateMetadata' });
        });

        it('must return metadata for a default audience', function test() {
          return this.users.router({ username, audience }, headers)
            .reflect()
            .then(inspectPromise())
            .then(getMetadata => {
              expect(getMetadata).to.be.deep.eq({
                [audience]: {
                  name: {
                    q: 'verynicedata',
                  },
                },
              });
            });
        });

        it('must return metadata for default and passed audiences', function test() {
          return this.users.router({ username, audience: [audience, 'matic.ninja'] }, headers)
            .reflect()
            .then(inspectPromise())
            .then(getMetadata => {
              expect(getMetadata).to.be.deep.eq({
                [audience]: {
                  name: {
                    q: 'verynicedata',
                  },
                },
                'matic.ninja': {
                  iat: 10,
                },
              });
            });
        });
      });
    });

    describe('#updateMetadata', function getMetadataSuite() {
      const headers = { routingKey: 'users.updateMetadata' };
      const username = 'v@makeomatic.ru';
      const audience = '*.localhost';

      beforeEach(function pretest() {
        return this.users.router({ username, password: '123', audience }, { routingKey: 'users.register' });
      });

      it('must reject updating metadata on a non-existing user', function test() {
        return this.users.router({ username: 'ok google', audience, metadata: { $remove: ['test'] } }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(getMetadata => {
            expect(getMetadata.name).to.be.eq('HttpStatusError');
            expect(getMetadata.statusCode).to.be.eq(404);
          });
      });

      it('must be able to add metadata for a single audience of an existing user', function test() {
        return this.users.router({ username, audience, metadata: { $set: { x: 10 } } }, headers)
          .reflect()
          .then(inspectPromise());
      });

      it('must be able to remove metadata for a single audience of an existing user', function test() {
        return this.users.router({ username, audience, metadata: { $remove: ['x'] } }, headers)
          .reflect()
          .then(inspectPromise());
      });

      it('must be able to perform batch add/remove operations for a single audience of an existing user');
    });

    describe('#requestPassword', function requestPasswordSuite() {
      const headers = { routingKey: 'users.requestPassword' };
      const username = 'v@makeomatic.ru';
      const audience = 'requestPassword';

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

    describe('#updatePassword', function updatePasswordSuite() {
      const headers = { routingKey: 'users.updatePassword' };
      const username = 'v@makeomatic.ru';
      const password = '123';
      const audience = '*.localhost';
      const emailValidation = require('../src/utils/send-email.js');

      beforeEach(function pretest() {
        return this.users.router({ username, password, audience }, { routingKey: 'users.register' });
      });

      it('must reject updating password for a non-existing user on username+password update', function test() {
        return this.users.router({ username: 'mcdon@tour.de.france', currentPassword: 'xxx', newPassword: 'vvv' }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(updatePassword => {
            expect(updatePassword.name).to.be.eq('HttpStatusError');
            expect(updatePassword.statusCode).to.be.eq(404);
          });
      });

      describe('user: inactive', function suite() {
        beforeEach(function pretest() {
          return this.users.redis.hset(redisKey(username, 'data'), 'active', 'false');
        });

        it('must reject updating password for an inactive account on username+password update', function test() {
          return this.users.router({ username, currentPassword: password, newPassword: 'vvv' }, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(updatePassword => {
              expect(updatePassword.name).to.be.eq('HttpStatusError');
              expect(updatePassword.statusCode).to.be.eq(412);
            });
        });
      });

      describe('user: banned', function suite() {
        beforeEach(function pretest() {
          return this.users.redis.hset(redisKey(username, 'data'), 'ban', 'true');
        });

        it('must reject updating password for an inactive account on username+password update', function test() {
          return this.users.router({ username, currentPassword: password, newPassword: 'vvv' }, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(updatePassword => {
              expect(updatePassword.name).to.be.eq('HttpStatusError');
              expect(updatePassword.statusCode).to.be.eq(423);
            });
        });
      });

      describe('user: active', function suite() {
        it('must reject updating password with an invalid username/password combination', function test() {
          return this.users.router({ username, currentPassword: 'xxx', newPassword: 'vvv' }, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(updatePassword => {
              expect(updatePassword.name).to.be.eq('HttpStatusError');
              expect(updatePassword.statusCode).to.be.eq(403);
            });
        });

        it('must update password with a valid username/password combination and different newPassword', function test() {
          return this.users.router({ username, currentPassword: password, newPassword: 'vvv', remoteip: '10.0.0.0' }, headers)
            .reflect()
            .then(inspectPromise())
            .then(updatePassword => {
              expect(updatePassword).to.be.deep.eq({ success: true });
            });
        });

        describe('token', function tokenSuite() {
          beforeEach(function pretest() {
            return emailValidation.send.call(this.users, username, 'reset').then(data => {
              this.token = data.context.qs.slice(3);
            });
          });

          it('must reject updating password for an invalid challenge token', function test() {
            return this.users.router({ resetToken: 'wrong', newPassword: 'vvv' }, headers)
              .reflect()
              .then(inspectPromise(false))
              .then(updatePassword => {
                expect(updatePassword.name).to.be.eq('HttpStatusError');
                expect(updatePassword.statusCode).to.be.eq(403);
              });
          });

          it('must update password passed with a valid challenge token', function test() {
            return this.users.router({ resetToken: this.token, newPassword: 'vvv' }, headers)
              .reflect()
              .then(inspectPromise())
              .then(updatePassword => {
                expect(updatePassword).to.be.deep.eq({ success: true });
              });
          });
        });
      });
    });

    describe('#ban', function banSuite() {
      const headers = { routingKey: 'users.ban' };
      const username = 'v@aminev.me';
      const password = '123';
      const audience = '*.localhost';

      it('must reject banning a non-existing user', function test() {
        return this.users.router({ username: 'doesntexist', ban: true }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(ban => {
            expect(ban.name).to.be.eq('HttpStatusError');
            expect(ban.statusCode).to.be.eq(404);
          });
      });

      describe('user: active', function suite() {
        beforeEach(function pretest() {
          return this.users.router({ username, password, audience }, { routingKey: 'users.register' });
        });

        it('must reject (un)banning a user without action being implicitly set', function test() {
          return this.users.router({ username }, headers)
            .reflect()
            .then(inspectPromise(false))
            .then(ban => {
              expect(ban.name).to.be.eq('ValidationError');
            });
        });

        it('must be able to ban an existing user', function test() {
          return this.users.router({ username, ban: true }, headers)
            .reflect()
            .then(inspectPromise())
            .then(ban => {
              expect(ban).to.be.eq(1);
            });
        });

        it('must be able to unban an existing user', function test() {
          return this.users.router({ username, ban: true }, headers)
            .then(() => {
              return this.users.router({ username, ban: false }, headers)
                .reflect()
                .then(inspectPromise())
                .then(ban => {
                  expect(ban).to.be.eq(1);
                });
            });
        });
      });
    });

    describe('#list', function listSuite() {
      this.timeout(10000);

      const faker = require('faker');
      const headers = { routingKey: 'users.list' };

      beforeEach(function populateRedis() {
        const audience = this.users._config.jwt.defaultAudience;
        const promises = [];
        const userSet = this.users._config.redis.userSet;

        ld.times(105, () => {
          const user = {
            id: faker.internet.email(),
            metadata: {
              firstName: faker.name.firstName(),
              lastName: faker.name.lastName(),
            },
          };

          promises.push(this.users._redis
            .pipeline()
            .sadd(userSet, user.id)
            .hmset(redisKey(user.id, 'metadata', audience), ld.mapValues(user.metadata, JSON.stringify, JSON))
            .exec()
          );
        });

        this.audience = audience;
        this.userStubs = Promise.all(promises);
        return this.userStubs;
      });

      it('able to list users without any filters: ASC', function test() {
        return this.users.router({
          offset: 51,
          limit: 10,
          order: 'ASC',
          audience: this.audience,
          filter: {},
        }, headers)
        .reflect()
        .then(result => {
          try {
            expect(result.isFulfilled()).to.be.eq(true);
            expect(result.value().page).to.be.eq(6);
            expect(result.value().pages).to.be.eq(11);
            expect(result.value().cursor).to.be.eq(61);
            expect(result.value().users).to.have.length.of(10);
            expect(result.value().users[0]).to.have.ownProperty('id');
            expect(result.value().users[0]).to.have.ownProperty('metadata');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

            const copy = [].concat(result.value().users);
            copy.sort((a, b) => {
              return a.id.toLowerCase() > b.id.toLowerCase();
            });

            expect(copy).to.be.deep.eq(result.value().users);
          } catch (e) {
            throw result.isRejected() ? result.reason() : e;
          }
        });
      });

      it('able to list users without any filters: DESC', function test() {
        return this.users.router({
          offset: 0,
          limit: 10,
          order: 'DESC',
          audience: this.audience,
          filter: {},
        }, headers)
        .reflect()
        .then(result => {
          try {
            expect(result.isFulfilled()).to.be.eq(true);
            expect(result.value().users).to.have.length.of(10);
            expect(result.value().users[0]).to.have.ownProperty('id');
            expect(result.value().users[0]).to.have.ownProperty('metadata');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

            const copy = [].concat(result.value().users);
            copy.sort((a, b) => {
              return a.id.toLowerCase() < b.id.toLowerCase();
            });

            expect(copy).to.be.deep.eq(result.value().users);
          } catch (e) {
            throw result.isRejected() ? result.reason() : e;
          }
        });
      });

      it('able to list users with # filter: ASC', function test() {
        return this.users.router({
          offset: 0,
          limit: 10,
          order: 'ASC',
          audience: this.audience,
          filter: {
            '#': 'an',
          },
        }, headers)
        .reflect()
        .then(result => {
          try {
            expect(result.isFulfilled()).to.be.eq(true);
            expect(result.value().users).to.have.length.lte(10);
            expect(result.value().users[0]).to.have.ownProperty('id');
            expect(result.value().users[0]).to.have.ownProperty('metadata');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

            const copy = [].concat(result.value().users);
            copy.sort((a, b) => {
              return a.id.toLowerCase() > b.id.toLowerCase();
            });

            copy.forEach((data) => {
              expect(data.id).to.match(/an/i);
            });

            expect(copy).to.be.deep.eq(result.value().users);
          } catch (e) {
            throw result.isRejected() ? result.reason() : e;
          }
        });
      });

      it('able to list users with # filter: DESC', function test() {
        return this.users.router({
          offset: 0,
          limit: 10,
          order: 'DESC',
          audience: this.audience,
          filter: {
            '#': 'an',
          },
        }, headers)
        .reflect()
        .then(result => {
          try {
            expect(result.isFulfilled()).to.be.eq(true);
            expect(result.value().users).to.have.length.lte(10);
            expect(result.value().users[0]).to.have.ownProperty('id');
            expect(result.value().users[0]).to.have.ownProperty('metadata');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

            const copy = [].concat(result.value().users);
            copy.sort((a, b) => {
              return a.id.toLowerCase() < b.id.toLowerCase();
            });

            copy.forEach((data) => {
              expect(data.id).to.match(/an/i);
            });

            expect(copy).to.be.deep.eq(result.value().users);
          } catch (e) {
            throw result.isRejected() ? result.reason() : e;
          }
        });
      });

      it('able to list users by meta field key: ASC', function test() {
        return this.users.router({
          offset: 0,
          limit: 10,
          order: 'ASC',
          criteria: 'firstName',
          audience: this.audience,
          filter: {},
        }, headers)
        .reflect()
        .then(result => {
          try {
            expect(result.isFulfilled()).to.be.eq(true);
            expect(result.value().users).to.have.length.lte(10);
            expect(result.value().users[0]).to.have.ownProperty('id');
            expect(result.value().users[0]).to.have.ownProperty('metadata');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

            const copy = [].concat(result.value().users);
            copy.sort((a, b) => {
              return a.metadata[this.audience].firstName.toLowerCase() > b.metadata[this.audience].firstName.toLowerCase();
            });

            expect(copy).to.be.deep.eq(result.value().users);
          } catch (e) {
            throw result.isRejected() ? result.reason() : e;
          }
        });
      });

      it('able to list users by meta field key: DESC', function test() {
        return this.users.router({
          offset: 0,
          limit: 10,
          order: 'DESC',
          criteria: 'firstName',
          audience: this.audience,
          filter: {},
        }, headers)
        .reflect()
        .then(result => {
          try {
            expect(result.isFulfilled()).to.be.eq(true);
            expect(result.value().users).to.have.length.lte(10);
            expect(result.value().users[0]).to.have.ownProperty('id');
            expect(result.value().users[0]).to.have.ownProperty('metadata');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

            const copy = [].concat(result.value().users);
            copy.sort((a, b) => {
              return a.metadata[this.audience].firstName.toLowerCase() < b.metadata[this.audience].firstName.toLowerCase();
            });

            expect(copy).to.be.deep.eq(result.value().users);
          } catch (e) {
            throw result.isRejected() ? result.reason() : e;
          }
        });
      });

      it('able to list users by meta field key with multiple filters: DESC', function test() {
        return this.users.router({
          offset: 0,
          limit: 10,
          order: 'DESC',
          criteria: 'firstName',
          audience: this.audience,
          filter: {
            '#': 'an',
            lastName: 'b',
          },
        }, headers)
        .reflect()
        .then(result => {
          try {
            expect(result.isFulfilled()).to.be.eq(true);
            expect(result.value().users).to.have.length.lte(10);
            expect(result.value().users[0]).to.have.ownProperty('id');
            expect(result.value().users[0]).to.have.ownProperty('metadata');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

            const copy = [].concat(result.value().users);
            copy.sort((a, b) => {
              return a.metadata[this.audience].firstName.toLowerCase() < b.metadata[this.audience].firstName.toLowerCase();
            });

            copy.forEach((data) => {
              expect(data.id).to.match(/an/i);
              expect(data.metadata[this.audience].lastName).to.match(/b/i);
            });

            expect(copy).to.be.deep.eq(result.value().users);
          } catch (e) {
            throw result.isRejected() ? result.reason() : e;
          }
        });
      });

      it('able to list users by meta field key with multiple filters: ASC', function test() {
        return this.users.router({
          offset: 0,
          limit: 10,
          order: 'ASC',
          criteria: 'lastName',
          audience: this.audience,
          filter: {
            '#': 'an',
            lastName: 'b',
          },
        }, headers)
        .reflect()
        .then(result => {
          try {
            expect(result.isFulfilled()).to.be.eq(true);
            expect(result.value().users).to.have.length.lte(10);
            expect(result.value().users[0]).to.have.ownProperty('id');
            expect(result.value().users[0]).to.have.ownProperty('metadata');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('firstName');
            expect(result.value().users[0].metadata[this.audience]).to.have.ownProperty('lastName');

            const copy = [].concat(result.value().users);
            copy.sort((a, b) => {
              return a.metadata[this.audience].lastName.toLowerCase() > b.metadata[this.audience].lastName.toLowerCase();
            });

            copy.forEach((data) => {
              expect(data.id).to.match(/an/i);
              expect(data.metadata[this.audience].lastName).to.match(/b/i);
            });

            expect(copy).to.be.deep.eq(result.value().users);
          } catch (e) {
            throw result.isRejected() ? result.reason() : e;
          }
        });
      });
    });
  });
});

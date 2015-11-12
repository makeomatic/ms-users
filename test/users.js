const URLSafeBase64 = require('urlsafe-base64');
const Promise = require('bluebird');
const chai = require('chai');
const sinon = require('sinon');
const { expect } = chai;
const MockServer = require('ioredis/test/helpers/mock_server.js');
const Errors = require('common-errors');
const ld = require('lodash');

// make sure we have stack
chai.config.includeStack = true;

const config = {
  amqp: {
    connection: {
      host: process.env.RABBITMQ_PORT_5672_TCP_ADDR || '127.0.0.1',
      port: +process.env.RABBITMQ_PORT_5672_TCP_PORT || 5672,
    },
  },
  redis: {
    hosts: [
      {
        host: process.env.REDIS_1_PORT_6379_TCP_ADDR || '127.0.0.1',
        port: +process.env.REDIS_1_PORT_6379_TCP_PORT || 30001,
      },
      {
        host: process.env.REDIS_2_PORT_6379_TCP_ADDR || '127.0.0.1',
        port: +process.env.REDIS_2_PORT_6379_TCP_PORT || 30002,
      },
      {
        host: process.env.REDIS_3_PORT_6379_TCP_ADDR || '127.0.0.1',
        port: +process.env.REDIS_3_PORT_6379_TCP_PORT || 30003,
      },
    ],
  },
};

describe('Users suite', function UserClassSuite() {
  const Users = require('../src');

  // inits redis mock cluster
  function redisMock() {
    const slotTable = [
      [0, 5460, ['127.0.0.1', 30001]],
      [5461, 10922, ['127.0.0.1', 30002]],
      [10923, 16383, ['127.0.0.1', 30003]],
    ];

    function argvHandler(argv) {
      if (argv[0] === 'cluster' && argv[1] === 'slots') {
        return slotTable;
      }
    }

    this.server_1 = new MockServer(30001, argvHandler);
    this.server_2 = new MockServer(30002, argvHandler);
    this.server_3 = new MockServer(30003, argvHandler);
  }

  // teardown cluster
  function tearDownRedisMock() {
    this.server_1.disconnect();
    this.server_2.disconnect();
    this.server_3.disconnect();
  }

  describe('configuration suite', function ConfigurationSuite() {
    beforeEach(redisMock);

    it('must throw on invalid configuration', function test() {
      expect(function throwOnInvalidConfiguration() {
        return new Users();
      }).to.throw(Errors.ValidationError);
    });

    it('must be able to connect to and disconnect from amqp', function test() {
      const users = new Users(config);
      return users._connectAMQP().tap(() => {
        return users._closeAMQP();
      });
    });

    it('must be able to connect to and disconnect from redis', function test() {
      const users = new Users(config);
      return users._connectRedis().tap(() => {
        return users._closeRedis();
      });
    });

    it('must be able to initialize and close service', function test() {
      const users = new Users(config);
      return users.connect().tap(() => {
        return users.close();
      });
    });

    afterEach(tearDownRedisMock);
  });

  describe('unit tests', function UnitSuite() {
    beforeEach(redisMock);

    beforeEach(function startService() {
      function emptyStub() {}

      this.users = new Users(config);
      this.users._mailer = {
        send: emptyStub,
      };
      this.users._redis = {};
      [
        'hexists', 'hsetnx', 'pipeline', 'expire', 'zadd', 'hgetallBuffer', 'get',
        'set', 'hget', 'hdel', 'del', 'hmgetBuffer', 'incrby', 'zrem', 'zscoreBuffer', 'hmget',
        'hset',
      ].forEach(prop => {
        this.users._redis[prop] = emptyStub;
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
      const headers = { routingKey: Users.defaultOpts.postfix.register };

      it('must reject invalid registration params and return detailed error', function test() {
        return this.users.router({}, headers)
          .reflect()
          .then((registered) => {
            expect(registered.isRejected()).to.be.eq(true);
            expect(registered.reason().name).to.be.eq('ValidationError');
            expect(registered.reason().errors).to.have.length.of(3);
          });
      });

      it('must be able to create user without validations and return user object and jwt token', function test() {
        const opts = {
          username: 'v@makeomatic.ru',
          password: 'mynicepassword',
          audience: 'matic.ninja',
        };

        const pipeline = { hsetnx: sinon.stub(), exec: sinon.stub() };
        pipeline.exec.returns(Promise.resolve([
          [ null, 1 ],
          [ null, 1 ],
        ]));

        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(false));
        sinon.stub(this.users._redis, 'pipeline').returns(pipeline);
        sinon.stub(this.users._redis, 'zadd').returns(1);
        sinon.stub(this.users._redis, 'hgetallBuffer')
          .onFirstCall().returns({})
          .onSecondCall().returns({});

        return this.users.router(opts, headers)
          .reflect()
          .then((registered) => {
            expect(registered.isFulfilled()).to.be.eq(true);
            expect(registered.value()).to.have.ownProperty('jwt');
            expect(registered.value()).to.have.ownProperty('user');
            expect(registered.value().user.username).to.be.eq(opts.username);
            expect(registered.value().user).to.have.ownProperty('metadata');
            expect(registered.value().user.metadata).to.have.ownProperty('matic.ninja');
            expect(registered.value().user.metadata).to.have.ownProperty('*.localhost');
            expect(registered.value().user).to.not.have.ownProperty('password');
            expect(registered.value().user).to.not.have.ownProperty('audience');
          });
      });

      it('must be able to create user with validation and return success', function test() {
        const opts = {
          username: 'v@makeomatic.ru',
          password: 'mynicepassword',
          audience: 'matic.ninja',
          activate: false,
        };

        const pipeline = { hsetnx: sinon.stub(), exec: sinon.stub() };
        pipeline.exec.returns(Promise.resolve([
          [ null, 1 ],
          [ null, 1 ],
        ]));

        const stub = sinon.stub().returns(Promise.resolve());
        this.users._mailer.send = stub;

        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(false));
        sinon.stub(this.users._redis, 'pipeline').returns(pipeline);
        sinon.stub(this.users._redis, 'get')
          .onFirstCall().returns(Promise.resolve());
        sinon.stub(this.users._redis, 'set')
          .onFirstCall().returns(Promise.resolve(1));

        return this.users.router(opts, headers)
          .delay(50)
          .reflect()
          .then((registered) => {
            expect(registered.isFulfilled()).to.be.eq(true);
            expect(registered.value()).to.be.deep.eq({
              requiresActivation: true,
            });
            expect(stub.calledOnce).to.be.eq(true);
          });
      });

      it('must reject registration for an already existing user', function test() {
        const opts = {
          username: 'v@makeomatic.ru',
          password: 'mynicepassword',
          audience: 'matic.ninja',
          activate: false,
        };

        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(true));

        return this.users.router(opts, headers)
          .delay(50)
          .reflect()
          .then((registered) => {
            expect(registered.isRejected()).to.be.eq(true);
            expect(registered.reason().name).to.be.eq('HttpStatusError');
            expect(registered.reason().statusCode).to.be.eq(403);
            expect(registered.reason().message).to.match(/"v@makeomatic\.ru" already exists/);
          });
      });

      it('must reject more than 3 registration a day per ipaddress if it is specified');
      it('must reject registration for disposable email addresses');
      it('must reject registration for a domain name, which lacks MX record');
      it('must reject registration when captcha is specified and its invalid');
      it('must register user when captcha is specified and its valid');
    });

    describe('#challenge', function challengeSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.challenge };

      it('must fail to send a challenge for a non-existing user', function test() {
        sinon.stub(this.users._redis, 'hget').returns(Promise.resolve(null));

        return this.users.router({ username: 'oops@gmail.com', type: 'email' }, headers)
          .reflect()
          .then((validation) => {
            expect(validation.isRejected()).to.be.eq(true);
            expect(validation.reason().name).to.be.eq('HttpStatusError');
            expect(validation.reason().statusCode).to.be.eq(404);
          });
      });

      it('must fail to send a challenge for an already active user', function test() {
        sinon.stub(this.users._redis, 'hget').returns(Promise.resolve('true'));

        return this.users.router({ username: 'oops@gmail.com', type: 'email' }, headers)
          .reflect()
          .then((validation) => {
            expect(validation.isRejected()).to.be.eq(true);
            expect(validation.reason().name).to.be.eq('HttpStatusError');
            expect(validation.reason().statusCode).to.be.eq(412);
          });
      });

      it('must be able to send challenge email', function test() {
        sinon.stub(this.users._redis, 'hget').returns(Promise.resolve('false'));
        sinon.stub(this.users._redis, 'get').returns(Promise.resolve(null));
        sinon.stub(this.users._redis, 'set').returns(Promise.resolve(1));
        sinon.stub(this.users._mailer, 'send').returns(Promise.resolve());

        return this.users.router({ username: 'oops@gmail.com', type: 'email' }, headers)
          .delay(50)
          .reflect()
          .then((validation) => {
            expect(validation.isFulfilled()).to.be.eq(true);
            expect(validation.value()).to.be.deep.eq({ queued: true });
            expect(this.users._mailer.send.calledOnce).to.be.eq(true);
          });
      });

      it('must fail to send challenge email more than once in an hour per user', function test() {
        sinon.stub(this.users._redis, 'hget').returns(Promise.resolve('false'));
        sinon.stub(this.users._redis, 'get').returns(Promise.resolve(true));

        return this.users.router({ username: 'oops@gmail.com', type: 'email' }, headers)
          .reflect()
          .then((validation) => {
            expect(validation.isRejected()).to.be.eq(true);
            expect(validation.reason().name).to.be.eq('HttpStatusError');
            expect(validation.reason().statusCode).to.be.eq(429);
          });
      });

      it('must fail to send challeng email during race condition', function test() {
        sinon.stub(this.users._redis, 'hget').returns(Promise.resolve('false'));
        sinon.stub(this.users._redis, 'get').returns(Promise.resolve(null));
        sinon.stub(this.users._redis, 'set').returns(Promise.resolve(0));

        return this.users.router({ username: 'oops@gmail.com', type: 'email' }, headers)
          .reflect()
          .then((validation) => {
            expect(validation.isRejected()).to.be.eq(true);
            expect(validation.reason().name).to.be.eq('HttpStatusError');
            expect(validation.reason().statusCode).to.be.eq(429);
          });
      });

      it('must validate MX record for a domain before sending an email');
    });

    describe('#activate', function activateSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.activate };
      const emailValidation = require('../src/utils/send-email.js');
      const email = 'v@example.com';

      beforeEach(function genToken() {
        const { algorithm, secret } = this.users._config.validation;
        const token = 'incredible-secret';
        this.token = URLSafeBase64.encode(emailValidation.encrypt(algorithm, secret, new Buffer(JSON.stringify({ email, token }))));
      });

      it('must reject activation when challenge token is invalid', function test() {
        return this.users.router({ token: 'useless-token', namespace: 'activate' }, headers)
          .reflect()
          .then((activation) => {
            expect(activation.isRejected()).to.be.eq(true);
            expect(activation.reason().name).to.be.eq('HttpStatusError');
            expect(activation.reason().statusCode).to.be.eq(403);
            expect(activation.reason().message).to.match(/could not decode token/);
          });
      });

      it('must reject activation when challenge token is expired or not found', function test() {
        sinon.stub(this.users._redis, 'get').returns(Promise.resolve(null));

        return this.users.router({ token: this.token, namespace: 'activate' }, headers)
          .reflect()
          .then((activation) => {
            expect(activation.isRejected()).to.be.eq(true);
            expect(activation.reason().name).to.be.eq('HttpStatusError');
            expect(activation.reason().statusCode).to.be.eq(404);
          });
      });

      it('must reject activation when associated email and the token doesn\'t match', function test() {
        sinon.stub(this.users._redis, 'get').returns(Promise.resolve('v@example.ru'));

        return this.users.router({ token: this.token, namespace: 'activate' }, headers)
          .reflect()
          .then((activation) => {
            expect(activation.isRejected()).to.be.eq(true);
            expect(activation.reason().name).to.be.eq('HttpStatusError');
            expect(activation.reason().statusCode).to.be.eq(412);
            expect(activation.reason().message).to.match(/associated email doesn\'t match token/);
          });
      });

      it('must reject activation when account is already activated', function test() {
        // mock pipeline response
        const pipeline = {
          exec: sinon.stub().returns(Promise.resolve([
            [ null, 'true' ],
          ])),
        };
        pipeline.hget = sinon.stub().returns(pipeline);
        pipeline.hset = sinon.stub().returns(pipeline);
        pipeline.persist = sinon.stub().returns(pipeline);
        sinon.stub(this.users._redis, 'pipeline').returns(pipeline);

        sinon.stub(this.users._redis, 'get').returns(Promise.resolve(email));
        sinon.stub(this.users._redis, 'del').returns(Promise.resolve());

        return this.users.router({ token: this.token, namespace: 'activate' }, headers)
          .reflect()
          .then((activation) => {
            expect(activation.isRejected()).to.be.eq(true);
            expect(activation.reason().name).to.be.eq('HttpStatusError');
            expect(activation.reason().statusCode).to.be.eq(413);
            expect(activation.reason().message).to.match(/Account v@example\.com was already activated/);
          });
      });

      it('must activate account when challenge token is correct and not expired', function test() {
        // mock pipeline response
        const jwt = require('../src/utils/jwt.js');
        const pipeline = {
          exec: sinon.stub().returns(Promise.resolve([
            [ null, 'false' ],
          ])),
        };
        pipeline.hget = sinon.stub().returns(pipeline);
        pipeline.hset = sinon.stub().returns(pipeline);
        pipeline.persist = sinon.stub().returns(pipeline);
        sinon.stub(this.users._redis, 'pipeline').returns(pipeline);

        sinon.stub(this.users._redis, 'get').returns(Promise.resolve(email));
        sinon.stub(this.users._redis, 'del').returns(Promise.resolve());

        const stub = sinon.stub(jwt, 'login').returns(Promise.resolve());

        return this.users.router({ token: this.token, namespace: 'activate' }, headers)
          .reflect()
          .then((activation) => {
            expect(activation.isFulfilled()).to.be.eq(true);
            expect(stub.calledOnce);
            stub.restore();
          });
      });

      it('must activate account when only username is specified as a service action', function test() {
        const jwt = require('../src/utils/jwt.js');
        const stub = sinon.stub(jwt, 'login').returns(Promise.resolve());

        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(true));

        const pipeline = {
          exec: sinon.stub().returns(Promise.resolve([
            [ null, 'false' ],
          ])),
        };
        pipeline.hget = sinon.stub().returns(pipeline);
        pipeline.hset = sinon.stub().returns(pipeline);
        pipeline.persist = sinon.stub().returns(pipeline);
        sinon.stub(this.users._redis, 'pipeline').returns(pipeline);

        return this.users.router({ username: 'v@makeomatic.ru' }, headers)
          .reflect()
          .then((activation) => {
            expect(activation.isFulfilled()).to.be.eq(true);
            expect(stub.calledOnce);
            stub.restore();
          });
      });

      it('must fail to activate account when only username is specified as a service action and the user does not exist', function test() {
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(false));

        return this.users.router({ username: 'v@makeomatic.ru' }, headers)
          .reflect()
          .then((activation) => {
            expect(activation.isRejected()).to.be.eq(true);
            expect(activation.reason().name).to.be.eq('HttpStatusError');
            expect(activation.reason().statusCode).to.be.eq(404);
            expect(activation.reason().message).to.be.eq('user does not exist');
          });
      });
    });

    describe('#login', function loginSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.login };
      const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
      const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };
      const scrypt = require('../src/utils/scrypt.js');

      before(function test() {
        return scrypt.hash(userWithValidPassword.password).then(pass => {
          this.password = pass;
        });
      });

      it('must reject login on a non-existing username', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([ null ]));

        return this.users.router(user, headers)
          .reflect()
          .then((login) => {
            expect(login.isRejected()).to.be.eq(true);
            expect(login.reason().name).to.be.eq('HttpStatusError');
            expect(login.reason().statusCode).to.be.eq(404);
          });
      });

      it('must reject login on an invalid password', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([ this.password, new Buffer('true') ]));

        return this.users.router(user, headers)
          .reflect()
          .then((login) => {
            expect(login.isRejected()).to.be.eq(true);
            expect(login.reason().name).to.be.eq('HttpStatusError');
            expect(login.reason().statusCode).to.be.eq(403);
          });
      });

      it('must reject login on an inactive account', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([ this.password, new Buffer('false') ]));

        return this.users.router(userWithValidPassword, headers)
          .reflect()
          .then((login) => {
            expect(login.isRejected()).to.be.eq(true);
            expect(login.reason().name).to.be.eq('HttpStatusError');
            expect(login.reason().statusCode).to.be.eq(412);
          });
      });

      it('must reject login on a banned account', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([ this.password, new Buffer('true'), new Buffer('true') ]));

        return this.users.router(userWithValidPassword, headers)
          .reflect()
          .then((login) => {
            expect(login.isRejected()).to.be.eq(true);
            expect(login.reason().name).to.be.eq('HttpStatusError');
            expect(login.reason().statusCode).to.be.eq(423);
          });
      });

      it('must login on a valid account with correct credentials', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([ this.password, new Buffer('true') ]));

        const jwt = require('../src/utils/jwt.js');
        const stub = sinon.stub(jwt, 'login').returns(Promise.resolve());

        return this.users.router(userWithValidPassword, headers)
          .reflect()
          .then((login) => {
            expect(login.isFulfilled()).to.be.eq(true);
            expect(stub.calledOnce).to.be.eq(true);
            stub.restore();
          });
      });

      it('must lock account for authentication after 5 invalid login attemps', function test() {
        const userWithRemoteIP = { remoteip: '10.0.0.1' };
        const pipeline = {};

        Object.assign(userWithRemoteIP, user);
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([ this.password, new Buffer('true') ]));
        sinon.stub(this.users._redis, 'pipeline').returns(pipeline);

        pipeline.exec = sinon.stub();
        pipeline.incrby = sinon.stub();
        pipeline.expire = sinon.stub();
        pipeline.exec.onCall(0).returns(Promise.resolve([[null, 1]]));
        pipeline.exec.onCall(1).returns(Promise.resolve([[null, 2]]));
        pipeline.exec.onCall(2).returns(Promise.resolve([[null, 3]]));
        pipeline.exec.onCall(3).returns(Promise.resolve([[null, 4]]));
        pipeline.exec.onCall(4).returns(Promise.resolve([[null, 5]]));
        pipeline.exec.onCall(5).returns(Promise.resolve([[null, 6]]));

        const promises = [];

        ld.times(5, () => {
          promises.push(
            this.users.router(userWithRemoteIP, headers)
              .reflect()
              .then((login) => {
                expect(login.isRejected()).to.be.eq(true);
                expect(login.reason().name).to.be.eq('HttpStatusError');
                expect(login.reason().statusCode).to.be.eq(403);
              })
          );
        });

        promises.push(
          this.users.router(userWithRemoteIP, headers)
            .reflect()
            .then((login) => {
              expect(login.isRejected()).to.be.eq(true);
              expect(login.reason().name).to.be.eq('HttpStatusError');
              expect(login.reason().statusCode).to.be.eq(429);
            })
        );

        return Promise.all(promises);
      });
    });

    describe('#logout', function logoutSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.logout };

      it('must reject logout on an invalid JWT token', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;

        return this.users.router({ jwt: 'tests', audience }, headers)
          .reflect()
          .then((logout) => {
            expect(logout.isRejected()).to.be.eq(true);
            expect(logout.reason().name).to.be.eq('HttpStatusError');
            expect(logout.reason().statusCode).to.be.eq(403);
          });
      });

      it('must delete JWT token from pool of valid tokens', function test() {
        const jwt = require('jsonwebtoken');
        const { hashingFunction: algorithm, secret, issuer, defaultAudience } = this.users._config.jwt;
        const token = jwt.sign({ username: 'vitaly' }, secret, { algorithm, audience: defaultAudience, issuer });

        sinon.stub(this.users._redis, 'zrem').returns(Promise.resolve(1));

        return this.users.router({ jwt: token, audience: defaultAudience }, headers)
          .reflect()
          .then((logout) => {
            expect(logout.isFulfilled()).to.be.eq(true);
            expect(logout.value()).to.be.deep.eq({ success: true });
          });
      });
    });

    describe('#verify', function verifySuite() {
      const headers = { routingKey: 'verify' };

      it('must reject on an invalid JWT token', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;

        return this.users.router({ token: 'invalid-token', audience }, headers)
          .reflect()
          .then(verify => {
            expect(verify.isRejected()).to.be.eq(true);
            expect(verify.reason().name).to.be.eq('HttpStatusError');
            expect(verify.reason().statusCode).to.be.eq(403);
            expect(verify.reason().message).to.be.eq('invalid token');
          });
      });

      it('must reject on an expired JWT token', function test() {
        const jwt = require('jsonwebtoken');
        const { hashingFunction: algorithm, secret, issuer, defaultAudience } = this.users._config.jwt;
        const token = jwt.sign({ username: 'vitaly' }, secret, { algorithm, audience: defaultAudience, issuer });

        // set expiration date to 1970
        sinon.stub(this.users._redis, 'zscoreBuffer').returns(Promise.resolve(0));

        return this.users.router({ token, audience: defaultAudience }, headers)
          .reflect()
          .then(verify => {
            expect(verify.isRejected()).to.be.eq(true);
            expect(verify.reason().name).to.be.eq('HttpStatusError');
            expect(verify.reason().statusCode).to.be.eq(403);
            expect(verify.reason().message).to.be.eq('token has expired or was forged');
          });
      });

      it('must return user object and required audiences information on a valid JWT token', function test() {
        const jwt = require('jsonwebtoken');
        const { hashingFunction: algorithm, secret, issuer, defaultAudience } = this.users._config.jwt;
        const token = jwt.sign({ username: 'vitaly' }, secret, { algorithm, audience: defaultAudience, issuer });

        // set expiration date to 1970
        sinon.stub(this.users._redis, 'zscoreBuffer').returns(Promise.resolve(Date.now()));
        sinon.stub(this.users._redis, 'zadd').returns(Promise.resolve());
        sinon.stub(this.users._redis, 'hgetallBuffer').returns({});

        return this.users.router({ token, audience: defaultAudience }, headers)
          .reflect()
          .then(verify => {
            expect(verify.isFulfilled()).to.be.eq(true);
            expect(verify.value()).to.be.deep.eq({
              username: 'vitaly',
              metadata: {
                [ defaultAudience ]: {},
              },
            });
            expect(this.users._redis.zadd.calledOnce).to.be.eq(true);
          });
      });
    });

    describe('#getMetadata', function getMetadataSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.getMetadata };

      it('must reject to return metadata on a non-existing username', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(null));

        return this.users.router({ username: 'noob', audience }, headers)
          .reflect()
          .then(getMetadata => {
            expect(getMetadata.isRejected()).to.be.eq(true);
            expect(getMetadata.reason().name).to.be.eq('HttpStatusError');
            expect(getMetadata.reason().statusCode).to.be.eq(404);
          });
      });

      it('must return metadata for a default audience of an existing user', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(true));
        sinon.stub(this.users._redis, 'hgetallBuffer').returns({
          name: new Buffer('{"q":"verynicedata"}'),
        });

        return this.users.router({ username: 'noob', audience }, headers)
          .reflect()
          .then(getMetadata => {
            expect(getMetadata.isFulfilled()).to.be.eq(true);
            expect(getMetadata.value()).to.be.deep.eq({
              [ audience ]: {
                name: {
                  q: 'verynicedata',
                },
              },
            });
          });
      });

      it('must return metadata for default and passed audiences of an existing user', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(true));
        sinon.stub(this.users._redis, 'hgetallBuffer')
          .onFirstCall().returns({
            name: new Buffer('{"q":"verynicedata"}'),
          })
          .onSecondCall().returns({
            iat: new Buffer('10'),
          });

        return this.users.router({ username: 'noob', audience: [ audience, 'matic.ninja' ] }, headers)
          .reflect()
          .then(getMetadata => {
            expect(getMetadata.isFulfilled()).to.be.eq(true);
            expect(getMetadata.value()).to.be.deep.eq({
              [ audience ]: {
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

    describe('#updateMetadata', function getMetadataSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.updateMetadata };

      it('must reject updating metadata on a non-existing user', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(null));

        return this.users.router({ username: 'noob', audience, metadata: { $remove: [ 'test' ] } }, headers)
          .reflect()
          .then(getMetadata => {
            expect(getMetadata.isRejected()).to.be.eq(true);
            expect(getMetadata.reason().name).to.be.eq('HttpStatusError');
            expect(getMetadata.reason().statusCode).to.be.eq(404);
          });
      });

      it('must be able to add metadata for a single audience of an existing user', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;
        const pipeline = {};
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(true));
        sinon.stub(this.users._redis, 'pipeline').returns(pipeline);

        pipeline.exec = sinon.stub().returns(Promise.resolve());
        pipeline.hmset = sinon.spy();

        return this.users.router({ username: 'noob', audience, metadata: { $set: { x: 10 } } }, headers)
          .reflect()
          .then(getMetadata => {
            expect(getMetadata.isFulfilled()).to.be.eq(true);
            expect(pipeline.hmset.calledOnce).to.be.eq(true);
            expect(pipeline.hmset.calledWithExactly(`noob!metadata!${audience}`, { x: '10' })).to.be.eq(true);
          });
      });

      it('must be able to remove metadata for a single audience of an existing user', function test() {
        const { defaultAudience: audience } = this.users._config.jwt;
        const pipeline = {};
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(true));
        sinon.stub(this.users._redis, 'pipeline').returns(pipeline);

        pipeline.exec = sinon.stub().returns(Promise.resolve());
        pipeline.hdel = sinon.spy();

        return this.users.router({ username: 'noob', audience, metadata: { $remove: [ 'x' ] } }, headers)
          .reflect()
          .then(getMetadata => {
            expect(getMetadata.isFulfilled()).to.be.eq(true);
            expect(pipeline.hdel.calledOnce).to.be.eq(true);
            expect(pipeline.hdel.calledWithExactly(`noob!metadata!${audience}`, [ 'x' ])).to.be.eq(true);
          });
      });

      it('must be able to perform batch add/remove operations for a single audience of an existing user');
    });

    describe('#requestPassword', function requestPasswordSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.requestPassword };

      it('must fail when user does not exist', function test() {
        sinon.stub(this.users._redis, 'hmget').returns(Promise.resolve([ null, null, null ]));

        return this.users.router({ username: 'noob' }, headers)
          .reflect()
          .then(requestPassword => {
            expect(requestPassword.isRejected()).to.be.eq(true);
            expect(requestPassword.reason().name).to.be.eq('HttpStatusError');
            expect(requestPassword.reason().statusCode).to.be.eq(404);
          });
      });

      it('must fail when account is inactive', function test() {
        sinon.stub(this.users._redis, 'hmget').returns(Promise.resolve([ 1, 'false', null ]));

        return this.users.router({ username: 'noob' }, headers)
          .reflect()
          .then(requestPassword => {
            expect(requestPassword.isRejected()).to.be.eq(true);
            expect(requestPassword.reason().name).to.be.eq('HttpStatusError');
            expect(requestPassword.reason().statusCode).to.be.eq(412);
          });
      });

      it('must fail when account is banned', function test() {
        sinon.stub(this.users._redis, 'hmget').returns(Promise.resolve([ 1, 'true', 'true' ]));

        return this.users.router({ username: 'noob' }, headers)
          .reflect()
          .then(requestPassword => {
            expect(requestPassword.isRejected()).to.be.eq(true);
            expect(requestPassword.reason().name).to.be.eq('HttpStatusError');
            expect(requestPassword.reason().statusCode).to.be.eq(423);
          });
      });

      it('must send challenge email for an existing user with an active account', function test() {
        const emailValidation = require('../src/utils/send-email.js');
        sinon.stub(this.users._redis, 'hmget').returns(Promise.resolve([ 1, 'true', null ]));
        const stub = sinon.stub(emailValidation, 'send').returns(Promise.resolve());

        return this.users.router({ username: 'noob' }, headers)
          .reflect()
          .then(requestPassword => {
            expect(requestPassword.isFulfilled()).to.be.eq(true);
            expect(requestPassword.value()).to.be.deep.eq({ success: true });
            expect(stub.calledOnce).to.be.eq(true);
            expect(stub.calledWithExactly('noob', 'reset')).to.be.eq(true);
            stub.restore();
          });
      });

      it('must reject sending reset password emails for an existing user more than once in 3 hours', function test() {
        sinon.stub(this.users._redis, 'hmget').returns(Promise.resolve([ 1, 'true', null ]));
        sinon.stub(this.users._redis, 'get').returns(Promise.resolve(1));

        return this.users.router({ username: 'noob' }, headers)
          .reflect()
          .then(requestPassword => {
            expect(requestPassword.isRejected()).to.be.eq(true);
            expect(requestPassword.reason().name).to.be.eq('HttpStatusError');
            expect(requestPassword.reason().statusCode).to.be.eq(429);
          });
      });
    });

    describe('#updatePassword', function updatePasswordSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.updatePassword };
      const email = 'v@example.com';
      const emailValidation = require('../src/utils/send-email.js');

      before(function genToken() {
        const { algorithm, secret } = this.users._config.validation;
        const token = 'incredible-secret';
        this.token = URLSafeBase64.encode(emailValidation.encrypt(algorithm, secret, new Buffer(JSON.stringify({ email, token }))));
      });

      it('must reject updating password for a non-existing user on usernamep+password update', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([
          null,
        ]));

        return this.users.router({ username: 'noob', currentPassword: 'xxx', newPassword: 'vvv' }, headers)
          .reflect()
          .then(updatePassword => {
            expect(updatePassword.isRejected()).to.be.eq(true);
            expect(updatePassword.reason().name).to.be.eq('HttpStatusError');
            expect(updatePassword.reason().statusCode).to.be.eq(404);
          });
      });

      it('must reject updating password for an inactive account on username+password update', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([
          new Buffer(''), new Buffer('false'),
        ]));

        return this.users.router({ username: 'noob', currentPassword: 'xxx', newPassword: 'vvv' }, headers)
          .reflect()
          .then(updatePassword => {
            expect(updatePassword.isRejected()).to.be.eq(true);
            expect(updatePassword.reason().name).to.be.eq('HttpStatusError');
            expect(updatePassword.reason().statusCode).to.be.eq(412);
          });
      });

      it('must reject updating password for an account with invalid hash on username+password update', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([
          new Buffer(''), new Buffer('true'),
        ]));

        return this.users.router({ username: 'noob', currentPassword: 'xxx', newPassword: 'vvv' }, headers)
          .reflect()
          .then(updatePassword => {
            expect(updatePassword.isRejected()).to.be.eq(true);
            expect(updatePassword.reason().name).to.be.eq('HttpStatusError');
            expect(updatePassword.reason().statusCode).to.be.eq(500);
          });
      });

      it('must reject updating password for an invalid challenge token', function test() {
        return this.users.router({ resetToken: 'wrong', newPassword: 'vvv' }, headers)
          .reflect()
          .then(updatePassword => {
            expect(updatePassword.isRejected()).to.be.eq(true);
            expect(updatePassword.reason().name).to.be.eq('HttpStatusError');
            expect(updatePassword.reason().statusCode).to.be.eq(403);
          });
      });

      it('must update password passed with a valid challenge token', function test() {
        sinon.stub(emailValidation, 'verify').returns(Promise.resolve(email));
        sinon.stub(this.users._redis, 'hset').returns(Promise.resolve(0));

        return this.users.router({ resetToken: this.token, newPassword: 'vvv' }, headers)
          .reflect()
          .then(updatePassword => {
            expect(updatePassword.isFulfilled()).to.be.eq(true);
            expect(emailValidation.verify.calledOnce).to.be.eq(true);
            expect(emailValidation.verify.calledWithExactly(this.token, 'reset', true)).to.be.eq(true);
            expect(updatePassword.value()).to.be.deep.eq({ success: true });

            emailValidation.verify.restore();
          });
      });

      it('must reject updating password with an invalid username/password combination', function test() {
        sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([
          new Buffer('dhasjdkahsdkja'), new Buffer('true'),
        ]));

        return this.users.router({ username: email, currentPassword: 'xxx', newPassword: 'vvv' }, headers)
          .reflect()
          .then(updatePassword => {
            expect(updatePassword.isRejected()).to.be.eq(true);
            expect(updatePassword.reason().name).to.be.eq('HttpStatusError');
            expect(updatePassword.reason().statusCode).to.be.eq(403);
          });
      });

      it('must update password with a valid username/password combination and different newPassword', function test() {
        const scrypt = require('../src/utils/scrypt.js');

        return scrypt.hash('superpassword').then(currentPasswordHash => {
          sinon.stub(this.users._redis, 'hmgetBuffer').returns(Promise.resolve([
            currentPasswordHash, new Buffer('true'),
          ]));
          sinon.stub(this.users._redis, 'hset').returns(Promise.resolve(0));
          sinon.stub(this.users._redis, 'del');

          return this.users.router({ username: email, currentPassword: 'superpassword', newPassword: 'vvv', remoteip: '10.0.0.0' }, headers)
            .reflect()
            .then(updatePassword => {
              expect(updatePassword.isFulfilled()).to.be.eq(true);
              expect(updatePassword.value()).to.be.deep.eq({ success: true });
              expect(this.users._redis.del.calledOnce).to.be.eq(true);
              expect(this.users._redis.del.calledWithExactly(`${email}!data!10.0.0.0`)).to.be.eq(true);
            });
        });
      });
    });

    describe('#ban', function banSuite() {
      const headers = { routingKey: Users.defaultOpts.postfix.ban };

      it('must reject banning a non-existing user', function test() {
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(false));

        return this.users.router({ username: 'doesntexist', ban: true }, headers)
          .reflect()
          .then(ban => {
            expect(ban.isRejected()).to.be.eq(true);
            expect(ban.reason().name).to.be.eq('HttpStatusError');
            expect(ban.reason().statusCode).to.be.eq(404);
          });
      });

      it('must reject (un)banning a user without action being implicitly set', function test() {
        return this.users.router({ username: 'exists' }, headers)
          .reflect()
          .then(ban => {
            expect(ban.isRejected()).to.be.eq(true);
            expect(ban.reason().name).to.be.eq('ValidationError');
          });
      });

      it('must be able to ban an existing user', function test() {
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(true));
        sinon.stub(this.users._redis, 'hset').returns(Promise.resolve(1));

        return this.users.router({ username: 'exists', ban: true }, headers)
          .reflect()
          .then(ban => {
            expect(ban.isFulfilled()).to.be.eq(true);
            expect(ban.value()).to.be.eq(1);
            expect(this.users._redis.hset.calledOnce).to.be.eq(true);
            expect(this.users._redis.hset.calledWithExactly(`exists!data`, 'ban', 'true'));
          });
      });

      it('must be able to unban an existing user', function test() {
        sinon.stub(this.users._redis, 'hexists').returns(Promise.resolve(true));
        sinon.stub(this.users._redis, 'hdel').returns(Promise.resolve(1));

        return this.users.router({ username: 'exists', ban: false }, headers)
          .reflect()
          .then(ban => {
            expect(ban.isFulfilled()).to.be.eq(true);
            expect(ban.value()).to.be.eq(1);
            expect(this.users._redis.hdel.calledOnce).to.be.eq(true);
            expect(this.users._redis.hdel.calledWithExactly(`exists!data`, 'ban'));
          });
      });
    });

    afterEach(tearDownRedisMock);
  });

  describe('integration tests', function integrationSuite() {
    describe('#register', function registerSuite() {
      it('must reject invalid registration params and return detailed error');
      it('must be able to create user without validations and return user object and jwt token');
      it('must be able to create user with validation and return success');
      it('must reject more than 3 registration a day per ipaddress if it is specified');
      it('must reject registration for an already existing user');
      it('must reject registration for disposable email addresses');
      it('must reject registration for a domain name, which lacks MX record');
    });

    describe('#challenge', function challengeSuite() {
      it('must fail to send a challenge for a non-existing user');
      it('must be able to send challenge email');
      it('must fail to send challenge email more than once in an hour per user');
      it('must validate MX record for a domain before sending an email');
    });

    describe('#activate', function activateSuite() {
      it('must reject activation when challenge token is invalid');
      it('must reject activation when challenge token is expired');
      it('must activate account when challenge token is correct and not expired');
      it('must activate account when no challenge token is specified as a service action');
    });

    describe('#login', function loginSuite() {
      it('must reject login on a non-existing username');
      it('must reject login on an invalid password');
      it('must reject login on an inactive account');
      it('must reject login on a banned account');
      it('must login on a valid account with correct credentials');
      it('must return User object and JWT token on login similar to #register+activate');
      it('must reject lock account for authentication after 3 invalid login attemps');
      it('must reset authentication attemps after resetting password');
    });

    describe('#logout', function logoutSuite() {
      it('must reject logout on an invalid JWT token');
      it('must delete JWT token from pool of valid tokens');
    });

    describe('#verify', function verifySuite() {
      it('must reject on an invalid JWT token');
      it('must reject on an expired JWT token');
      it('must return user object on a valid JWT token');
      it('must return user object and associated metadata on a valid JWT token with default audience');
      it('must return user object and associated metadata on a valid JWT token with provided audiences');
    });

    describe('#getMetadata', function getMetadataSuite() {
      it('must reject to return metadata on a non-existing username');
      it('must return metadata for a default audience of an existing user');
      it('must return metadata for default and passed audiences of an existing user');
    });

    describe('#updateMetadata', function getMetadataSuite() {
      it('must reject updating metadata on a non-existing user');
      it('must be able to add metadata for a single audience of an existing user');
      it('must be able to remove metadata for a single audience of an existing user');
      it('must be able to perform batch add/remove operations for a single audience of an existing user');
    });

    describe('#requestPassword', function requestPasswordSuite() {
      it('must reject for a non-existing user');
      it('must send challenge email for an existing user');
      it('must reject sending reset password emails for an existing user more than once in 3 hours');
    });

    describe('#updatePassword', function updatePasswordSuite() {
      it('must reject updating password for a non-existing user');
      it('must reject updating password for an invalid challenge token');
      it('must update password passed with a valid challenge token');
      it('must fail to update password with a valid challenge token, when it doesn\'t conform to password requirements');
      it('must reset login attemts for a user after resetting password');
    });

    describe('#ban', function banSuite() {
      it('must reject banning a non-existing user');
      it('must reject (un)banning a user without action being implicitly set');
      it('must ban an existing user');
      it('must unban an existing user');
      it('must fail to unban not banned user');
      it('must fail to ban already banned user');
    });
  });
});

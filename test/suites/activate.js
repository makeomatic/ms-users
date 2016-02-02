/* global inspectPromise */
const { expect } = require('chai');
const redisKey = require('../../src/utils/key.js');
const URLSafeBase64 = require('urlsafe-base64');

describe('#activate', function activateSuite() {
  const headers = { routingKey: 'users.activate' };
  const emailValidation = require('../../src/utils/send-email.js');
  const email = 'v@aminev.me';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

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
          expect(activation.statusCode).to.be.eq(412);
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
      });
  });
});

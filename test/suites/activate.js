/* global inspectPromise */
const { expect } = require('chai');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#activate', function activateSuite() {
  const email = 'v@aminev.me';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function genToken() {
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
    return simpleDispatcher(this.users.router)('users.activate', params)
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
      const params = {
        username: email,
        password: '123',
        audience: 'ok',
        activate: true,
        metadata: {
          wolf: true,
        },
      };
      return simpleDispatcher(this.users.router)('users.register', params);
    });

    it('must reject activation when account is already activated', function test() {
      const params = { token: this.token };
      return simpleDispatcher(this.users.router)('users.activate', params)
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
      const params = { username: email, password: '123', audience: 'ok', metadata: { wolf: true }, activate: false };
      return simpleDispatcher(this.users.router)('users.register', params);
    });

    it('must activate account when challenge token is correct and not expired', function test() {
      return simpleDispatcher(this.users.router)('users.activate', { token: this.token })
        .reflect()
        .then(inspectPromise());
    });
  });

  describe('activate inactive existing user', function suite() {
    beforeEach(function pretest() {
      const params = { username: 'v@makeomatic.ru', password: '123', audience: 'ok', metadata: { wolf: true }, activate: false };
      return simpleDispatcher(this.users.router)('users.register', params);
    });

    it('must activate account when only username is specified as a service action', function test() {
      return simpleDispatcher(this.users.router)('users.activate', {
        username: 'v@makeomatic.ru',
      })
      .reflect()
      .then(inspectPromise());
    });
  });

  it('must fail to activate account when only username is specified as a service action and the user does not exist', function test() {
    return simpleDispatcher(this.users.router)('users.activate', { username: 'v@makeomatic.ru' })
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
});

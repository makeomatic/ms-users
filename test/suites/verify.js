/* global inspectPromise */
const { expect } = require('chai');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#verify', function verifySuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject on an invalid JWT token', function test() {
    const { defaultAudience: audience } = this.users._config.jwt;

    return simpleDispatcher(this.users.router)('users.verify', { token: 'invalid-token', audience })
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

    return simpleDispatcher(this.users.router)('users.verify', { token, audience: defaultAudience })
      .reflect()
      .then(inspectPromise(false))
      .then(verify => {
        expect(verify.name).to.be.eq('HttpStatusError');
        expect(verify.statusCode).to.be.eq(403);
        expect(verify.message).to.be.eq('token has expired or was forged');
      });
  });

  describe('valid token', function suite() {
    const jwt = require('../../src/utils/jwt.js');

    beforeEach(function pretest() {
      return simpleDispatcher(this.users.router)('users.register', {
        username: 'v@makeomatic.ru',
        password: '123',
        audience: 'test',
        metadata: {
          fine: true,
        },
      });
    });

    beforeEach(function pretest() {
      return jwt.login.call(this.users, 'v@makeomatic.ru', 'test').then(data => {
        this.token = data.jwt;
      });
    });

    it('must return user object and required audiences information on a valid JWT token', function test() {
      return simpleDispatcher(this.users.router)('users.verify', { token: this.token, audience: 'test' })
        .reflect()
        .then(inspectPromise())
        .then(verify => {
          expect(verify.username).to.be.eq('v@makeomatic.ru');
          expect(verify.metadata['*.localhost'].username).to.be.eq('v@makeomatic.ru');
          expect(verify.metadata.test).to.be.deep.eq({
            fine: true,
          });
        });
    });
  });
});

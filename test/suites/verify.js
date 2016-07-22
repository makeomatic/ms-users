/* global inspectPromise */
const { expect } = require('chai');

describe('#verify', function verifySuite() {
  const headers = { routingKey: 'users.verify' };

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject on an invalid JWT token', function test() {
    const { defaultAudience: audience } = this.users._config.jwt;

    return this.users.router.dispatch('users.verify', { params: { token: 'invalid-token', audience }, transport: 'amqp' })
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
    const jwt = require('../../src/utils/jwt.js');

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
              test: {
                username: 'v@makeomatic.ru',
              },
            },
          });
        });
    });
  });
});

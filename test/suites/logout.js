/* global inspectPromise */
const { expect } = require('chai');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#logout', function logoutSuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must reject logout on an invalid JWT token', function test() {
    const { defaultAudience: audience } = this.users._config.jwt;

    return simpleDispatcher(this.users.router)('users.logout', { jwt: 'tests', audience })
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

    return simpleDispatcher(this.users.router)('users.logout', { jwt: token, audience: defaultAudience })
      .reflect()
      .then(inspectPromise())
      .then(logout => {
        expect(logout).to.be.deep.eq({ success: true });
      });
  });
});

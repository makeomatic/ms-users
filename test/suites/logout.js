/* global inspectPromise */
const { expect } = require('chai');

describe('#logout', function logoutSuite() {
  const headers = { routingKey: 'users.logout' };

  beforeEach(global.startService);
  afterEach(global.clearRedis);

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

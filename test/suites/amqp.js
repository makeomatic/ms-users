const { inspectPromise } = require('@makeomatic/deploy');
const { expect } = require('chai');

describe('#AMQP', function AMQPSuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('should be able to make requests using AMQP transport', function test() {
    const { defaultAudience: audience } = this.users.config.jwt;

    return this.users.amqp.publishAndWait('users.verify', { token: 'invalid-token', audience })
      .reflect()
      .then(inspectPromise(false))
      .then((error) => {
        expect(error.name).to.be.eq('HttpStatusError');
        expect(error.statusCode).to.be.eq(403);
        expect(error.message).to.be.eq('invalid token');
      });
  });
});

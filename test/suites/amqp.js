const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../config');

describe('#AMQP', function AMQPSuite() {
  beforeEach(startService);
  afterEach(clearRedis);

  it('should be able to make requests using AMQP transport', async function test() {
    const { defaultAudience: audience } = this.users.config.jwt;

    await assert.rejects(this.users.amqp.publishAndWait('users.verify', { token: 'invalid-token', audience }), {
      name: 'HttpStatusError',
      statusCode: 403,
      message: 'invalid token',
    });
  });
});

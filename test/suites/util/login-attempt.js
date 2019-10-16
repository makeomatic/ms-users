/* global startService, clearRedis */
const assert = require('assert');

const LoginAttempt = require('../../../src/utils/login-attempt');

describe('#login-attempt', function userIpSuite() {
  let loginAttempt;
  const userId = '123123123';

  before(async () => {
    await startService.call(this);
    loginAttempt = new LoginAttempt(this.users.redis, 'testIpRegistry');
  });

  after(clearRedis.bind(this));

  afterEach(clearRedis.bind(this, true));

  it('saves user login attempts ', async () => {
    await loginAttempt.addAttempt(userId, 'FooToken');

    const userAttempts = await loginAttempt.getAttempts(userId);
    assert.deepStrictEqual(userAttempts, ['FooToken']);
  });

  it('removes user login attempts', async () => {
    await loginAttempt.addAttempt(userId, 'barToken');
    await loginAttempt.deleteAttempt(userId, 'barToken');

    const userIps = await loginAttempt.getAttempts(userId);
    assert.deepStrictEqual(userIps, []);
  });
});

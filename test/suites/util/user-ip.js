/* global startService, clearRedis */
const assert = require('assert');

const UserIp = require('../../../src/utils/user-ip');

describe('#user-ip-manager', function loginSuite() {
  let userIp;
  const userId = '123123123';

  before(async () => {
    await startService.call(this);
    userIp = new UserIp(this.users.redis, 'testIpRegistry');
  });

  after(clearRedis.bind(this));

  afterEach(clearRedis.bind(this, true));

  it('saves user ips ', async () => {
    await userIp.addIp(userId, '10.1.1.1');

    const userIps = await userIp.getIps(userId);
    assert.deepStrictEqual(userIps, ['10.1.1.1']);
  });

  it('removes user ips ', async () => {
    await userIp.addIp(userId, '10.1.1.1');

    await userIp.cleanIps(userId);

    const userIps = await userIp.getIps(userId);
    assert.deepStrictEqual(userIps, []);
  });
});

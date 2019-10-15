/* global startService, clearRedis */
const assert = require('assert');

const UserIpManager = require('../../../src/utils/user-ip-manager');

describe('#user-ip-manager', function loginSuite() {
  let userIpManager;
  const userId = '123123123';

  before(async () => {
    await startService.call(this);
    userIpManager = new UserIpManager(this.users.redis, 'testIpRegistry');
  });

  after(clearRedis.bind(this));

  afterEach(clearRedis.bind(this, true));

  it('saves user ips ', async () => {
    await userIpManager.addIp(userId, '10.1.1.1');

    const userIps = await userIpManager.getIps(userId);
    assert.deepStrictEqual(userIps, ['10.1.1.1']);
  });

  it('removes user ips ', async () => {
    await userIpManager.addIp(userId, '10.1.1.1');

    await userIpManager.cleanIps(userId);

    const userIps = await userIpManager.getIps(userId);
    assert.deepStrictEqual(userIps, []);
  });
});

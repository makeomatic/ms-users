const assert = require('node:assert/strict');
const Promise = require('bluebird');
const sinon = require('sinon');
const { startService, clearRedis } = require('../../../config');

const { createCfList, nockCfApi, restoreCfApi } = require('../../../helpers/cloudflare/api-stub');

const asArray = async (generator) => {
  const items = [];
  for await (const item of generator) {
    items.push(...item);
  }
  return items;
};

describe('#cloudflare access-list stubbed', () => {
  let sandbox;
  let service;

  before(async () => {
    service = await startService.call(this, {
      cfAccessList: {
        enabled: false,
        worker: {
          enabled: false,
        },
      },
    });
  });

  after(async () => {
    if (this.users) {
      await clearRedis.call(this, false);
    }
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    const { storage } = nockCfApi();
    this.nockStorage = storage;
  });

  afterEach(async () => {
    await clearRedis.call(this, true);
    sandbox.restore();
    restoreCfApi();
  });

  it('should add ip', async () => {
    const { redis } = service;
    const list = createCfList(service, {
      accessList: { ttl: 2000 },
    });

    const { id: ipList } = await list.cfApi.createList('test_add_ip');
    await list.addIP({ ip: '4.3.2.1' });

    const ipsInList = await redis.hgetall('cf:ip-to-list');
    const cfListInfo = await redis.zrange('cf:available-lists', 0, -1, 'WITHSCORES');
    const cfListTTL = await redis.ttl('cf:available-lists');

    assert(cfListTTL > 9998, 'should be close to 10000');
    assert.strictEqual(Object.entries(ipsInList).length, 1);
    assert.deepStrictEqual(cfListInfo, [ipList, '1'], 'should have 1 list with 1 ip');
  });

  it('should panic when bulk operation fails', async () => {
    const list = createCfList(service);
    await list.cfApi.createList('test_fail_bulk_operation');
    await assert.rejects(list.addIP({ ip: '5.6.7.8' }), /BulkOperationError: Simulated error/);
  });

  it('should retry when bulk operation request fails', async () => {
    const list = createCfList(service);
    await list.cfApi.createList('test_retry_bulk_operation');
    await list.addIP({ ip: '5.6.7.8' });
  });

  it('should handle `success: false` operation response', async () => {
    const list = createCfList(service);
    await list.cfApi.createList('test_successfalse_bulk_operation');

    await assert.rejects(
      list.addIP({ ip: '5.6.7.8' }),
      /CfApiError: \[1003\] Invalid something/
    );
  });

  it('should handle `pending` operation response', async () => {
    const list = createCfList(service);
    await list.cfApi.createList('test_pending_bulk_operation');
    await list.addIP({ ip: '5.6.7.8' });
  });

  it('should panic when all lists full', async () => {
    const list = createCfList(service);
    const { id: ipList } = await list.cfApi.createList('test_full_list');

    // cf Limit 1000 items
    this.nockStorage.lists[ipList].num_items = 1000;

    await assert.rejects(list.addIP({ ip: '7.7.7.7' }), /ListFullError: no free list/);
  });

  it('should ignore list without prefix', async () => {
    const list = createCfList(service, { accessList: { prefix: 'custom' } });

    await list.cfApi.createList('test-prefix-list');
    const { id: ipList } = await list.cfApi.createList('custom-prefix-list');

    const lists = await list.getCFLists();
    assert.strictEqual(Object.entries(lists).length, 1);
    assert(Object.keys(lists).includes(ipList), 'should include list');
  });

  it('should get all ips from list', async () => {
    const list = createCfList(service);

    const { id: secondIpList } = await list.cfApi.createList('test-second-list');
    const { id: ipList } = await list.cfApi.createList('test-list');

    const ips = [
      '7.7.7.1', '7.7.7.2',
      '7.7.7.3', '7.7.7.4',
      '7.7.7.5', '7.7.7.6',
      '7.7.7.7', '7.7.7.8',
      '7.7.7.9',
    ];

    await Promise.map(ips, (ip) => list.addIP({ ip }));

    const ipAddresses = [
      ...await asArray(list.getListIPsGenerator(ipList)),
      ...await asArray(list.getListIPsGenerator(secondIpList)),
    ];

    assert.strictEqual(ipAddresses.length, 9);
  });

  it('should find list for ip', async () => {
    const list = createCfList(service);

    const { id: ipList } = await list.cfApi.createList('test-list');

    await list.addIP({ ip: '5.7.7.7' });
    await list.addIP({ ip: '5.7.7.8' });

    const listId = await list.findRuleListId('5.7.7.7');
    assert.strictEqual(listId, ipList);
  });

  it('should not update ip count when `touch` ip', async () => {
    const list = createCfList(service);

    const { id: ipList } = await list.cfApi.createList('test-list');
    await list.addIP({ ip: '5.7.7.7' });

    const afterCreate = await list.getCFLists();
    assert.strictEqual(afterCreate[ipList], 1);

    await list.touchIP({ ip: '5.7.7.7' }, ipList);

    const afterTouch = await list.getCFLists();
    assert.strictEqual(afterTouch[ipList], 1);
    assert.strictEqual(Object.keys(afterTouch).length, 1);
  });

  it('should cleanup all outdated ips', async () => {
    const list = createCfList(service);
    sandbox.useFakeTimers({ now: Date.now(), toFake: ['setTimeout', 'setInterval'] });

    const { id: ipList } = await list.cfApi.createList('test-list-cleanup-outdated');

    const ips = ['4.7.7.7', '4.7.7.8', '4.7.7.9', '4.7.7.10'];
    const afterIps = ['4.7.7.9', '4.7.7.10'];

    await Promise.mapSeries(ips, async (ip) => {
      sandbox.clock.tick(1000);
      await list.addIP({ ip });
    });

    await list.cleanupList(ipList);

    const afterCleanup = await asArray(list.getListIPsGenerator(ipList));
    assert.deepStrictEqual(afterCleanup.map(({ ip }) => ip), afterIps);

    const inRedisLength = await service.redis.hlen('cf:ip-to-list');
    const inRedis = await service.redis.hmget('cf:ip-to-list', '4.7.7.7', '4.7.7.8');
    const listInfo = await list.getCFLists();

    assert.strictEqual(inRedisLength, 2);
    assert.deepStrictEqual(inRedis, [null, null]);
    assert.deepStrictEqual(listInfo, { 'list-test-list-cleanup-outdated': 2 });
  });

  it('should resync lists', async () => {
    const list = createCfList(service);
    sandbox.useFakeTimers({ now: Date.now(), toFake: ['setTimeout', 'setInterval'] });

    const { id: ipList } = await list.cfApi.createList('test-list-cleanup-outdated');

    const ips = ['3.7.7.7', '3.7.7.8', '3.7.7.9', '3.7.7.10'];

    await Promise.mapSeries(ips, async (ip) => {
      sandbox.clock.tick(1000);
      await list.addIP({ ip });
    });

    const beforeListInfo = await list.getCFLists();
    const beforeIps = await asArray(list.getListIPsGenerator(ipList));

    assert.strictEqual(beforeListInfo[ipList], 4);
    assert.strictEqual(beforeIps.length, 4);

    this.nockStorage.listIps[ipList] = this.nockStorage.listIps[ipList].slice(2, 4);
    await list.resyncList(ipList);

    const afterListInfo = await list.getCFLists();
    const afterIps = await asArray(list.getListIPsGenerator(ipList));

    assert.strictEqual(afterListInfo[ipList], 2);
    assert.strictEqual(afterIps.length, 2);
  });
});

const { once } = require('events');
const assert = require('node:assert/strict');
const sinon = require('sinon');
const prepareUsers = require('../../../../src');
const { clearRedis } = require('../../../config');

const { nockCfApi, restoreCfApi } = require('../../../helpers/cloudflare/api-stub');

describe('#cloudflare access-list worker', () => {
  const Timeout = (setTimeout(() => {}, 0).unref()).constructor;
  const createService = async (config) => {
    this.users = await prepareUsers(config);
  };

  beforeEach('start', () => {
    nockCfApi();
  });

  afterEach('stop', async () => {
    if (this.users) {
      await clearRedis.call(this, false);
    }
    restoreCfApi();
  });

  it('should set interval job', async () => {
    await createService({
      cfAccessList: {
        enabled: true,
        worker: {
          enabled: true,
          cleanupInterval: 2000,
        },
      },
    });

    await this.users.connect();
    await this.users.cfAccessList.cfApi.createList('test_worker_test_list');

    const { cfWorker } = this.users;
    const startSpy = sinon.spy(cfWorker, 'start');
    assert(cfWorker.next instanceof Timeout);

    await once(cfWorker, 'done');
    await once(cfWorker, 'done');

    assert(startSpy.callCount === 2, 'should be called twice');
  });
});

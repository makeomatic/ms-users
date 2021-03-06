const { assert } = require('chai');
const { once } = require('events');
const sinon = require('sinon');

const { CloudflareWorker } = require('../../../../src/utils/cloudflare/worker');
const Users = require('../../../../src');

const { nockCfApi, restoreCfApi } = require('../../../helpers/cloudflare/api-stub');

describe('#cloudflare access-list worker', () => {
  const Timeout = (setTimeout(() => {}, 0)).constructor;
  const createService = (config) => {
    this.users = new Users(config);
  };

  beforeEach('start', () => {
    nockCfApi();
  });

  afterEach('stop', async () => {
    if (this.users) {
      await global.clearRedis.call(this, false);
    }
    restoreCfApi();
  });

  it('should set interval job', async () => {
    createService({
      cfAccessList: {
        enabled: true,
        worker: {
          enabled: true,
          cleanupInterval: 2000,
        },
      },
    });
    const startSpy = sinon.spy(CloudflareWorker.prototype, 'start');

    await this.users.connect();
    await this.users.cfAccessList.cfApi.createList('test_worker_test_list');

    const { cfWorker } = this.users;
    assert(cfWorker.next instanceof Timeout);

    await once(cfWorker, 'done');
    await once(cfWorker, 'done');

    assert(startSpy.callCount === 2, 'should be called twice');
  });
});

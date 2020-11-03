const assert = require('assert');
const os = require('os');

const randomIp = `127.0.0.${Math.floor(Math.random() * 250) + 1}`;
const jobId = `${os.hostname()}_test_${randomIp}`;

/**
 * Includes E2E tests for Cloudflare API.
 * Other checks stubbed
 */
describe('#cloudflare.add-to-list action', () => {
  const createdIps = [];
  let usedList;

  /* Restart service before each test to achieve clean database. */
  before('start', async () => {
    await global.startService.call(this, {
      cfAccessList: {
        enabled: true,
        worker: { enabled: false },
      },
    });
  });

  after('stop', async () => {
    const toDelete = createdIps.map((({ id }) => id));
    await this.users.cfAccessList.cfApi.deleteListItems(usedList, toDelete);
    await global.clearRedis.call(this, false);
  });

  it('should add ip', async () => {
    usedList = await this.dispatch('users.cf.add-to-access-list', { remoteip: randomIp, comment: jobId });
    const ips = [];
    const ipsGenerator = this.users.cfAccessList.getListIPsGenerator(usedList);
    for await (const ip of ipsGenerator) {
      ips.push(...ip);
    }

    createdIps.push(...ips.filter(({ comment }) => comment === jobId));
    assert.deepStrictEqual(createdIps.length, 1);
  });

  it('should touch ip', async () => {
    const ips = [];

    await this.dispatch('users.cf.add-to-access-list', { remoteip: randomIp, comment: jobId });
    const ipsGenerator = this.users.cfAccessList.getListIPsGenerator(usedList);

    for await (const ip of ipsGenerator) {
      ips.push(...ip);
    }

    const filteredIps = ips.filter(({ comment }) => comment === jobId);
    // should contain only 1 IP
    assert.deepStrictEqual(filteredIps.length, 1);
  });
});

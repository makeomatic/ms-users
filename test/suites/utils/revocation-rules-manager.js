const { delay } = require('bluebird');
const { NotFoundError } = require('common-errors');
const { once } = require('events');
const assert = require('assert');
const sinon = require('sinon');

const { RevocationRulesManager, DONE_EVENT } = require('../../../src/utils/revocation-rules-manager');

describe('ttl cleanup', () => {
  const updateAction = 'users.revoke-rule.update';
  const getAction = 'users.revoke-rule.get';
  const spy = sinon.spy(RevocationRulesManager.prototype, 'scheduleExpire');

  let ind = 1;
  const getConfig = () => {
    ind += 1;
    return {
      http: {
        server: {
          port: 3000 + ind,
        },
      },
      prometheus: {
        config: {
          port: 9102 + ind,
        },
      },
      revocationRulesManager: {
        enabled: true,
        jobsEnabled: true,
        cleanupInterval: 200,
      },
    };
  };

  beforeEach('start', async () => {
    await global.startService.call(this, getConfig());

    await this.users.revocationRulesManager.batchDelete(['']);
  });

  after('stop', async () => {
    await global.clearRedis.call(this, false);
  });

  afterEach('reset stub', () => {
    spy.resetHistory();
  });

  it('should retake consul lock', async () => {
    const secondNs = {};

    await once(this.users, DONE_EVENT);

    await global.startService.call(secondNs, getConfig());

    await global.clearRedis.call(this, false);

    await once(secondNs.users, DONE_EVENT);

    await global.startService.call(this, getConfig());

    await global.clearRedis.call(secondNs, false);

    await once(this.users, DONE_EVENT);

    await global.clearRedis.call(this, false);
  });

  it('should perform cleanup and reschedule task', async () => {
    const createdRule = await this.dispatch(updateAction, {
      username: 'some',
      rule: {
        params: {
          iat: { lte: 1212 },
          ttl: Date.now() - 10000,
        },
      },
    });

    const waitDelete = async () => {
      try {
        const rule = await this.dispatch(getAction, { username: 'some', rule: createdRule.rule });
        if (rule) {
          await delay(200);
          return waitDelete();
        }
      } catch (e) {
        if (e instanceof NotFoundError) {
          return true;
        }
      }
      return false;
    };

    const waitResult = await waitDelete();

    assert.strictEqual(waitResult, true);
    assert(spy.callCount > 0);
  });
});

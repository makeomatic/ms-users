const { strict: assert } = require('assert');
const sinon = require('sinon');
const { startService, clearRedis } = require('../../config');
const hook = require('../../../src/custom/cappasity-cf-access-list');

describe('#cappasity-user-login-hook', () => {
  const username = 'some@user-mail.com';
  const password = '123';
  const audience = '*.localhost';
  const userData = {
    username,
    password,
    audience,
    activate: true,
    skipChallenge: true,
    metadata: {
      plan: 'free',
    },
  };

  let service;
  let sandbox;

  /* Restart service before each test to achieve clean database. */
  before('start', async () => {
    sandbox = sinon.createSandbox();
    sandbox.spy(hook);

    service = await startService.call(this, {
      cfAccessList: {
        enabled: true,
        worker: { enabled: false },
      },
      hooks: {
        'users:login': hook,
      },
    });

    const amqpStub = sandbox.stub(service.amqp, 'publish');

    amqpStub.withArgs('users.cf.add-to-access-list').resolves();
    amqpStub.callThrough();

    await service.dispatch('register', { params: userData });
  });

  afterEach('reset stub history', () => {
    sandbox.resetHistory();
  });

  after('stop', async () => {
    await clearRedis.call(this);
  });

  it('should not call `cf.add-to-access-list` if `plan` is `free`', async () => {
    await this.users.dispatch('login', { params: { username, password, audience, remoteip: '8.8.8.8' } });
    assert.strictEqual(service.amqp.publish.called, false, 'should not be called');
  });

  it('should call `cf.add-to-access-list` if `plan` is not `free`', async () => {
    await this.users.dispatch('updateMetadata', { params: {
      username,
      audience: [audience],
      metadata: [{ $set: { plan: 'enterprise' } }],
    } });

    await this.users.dispatch('login', { params: { username, password, audience, remoteip: '8.8.8.8' } });
    const [publishCall] = service.amqp.publish.getCalls();
    assert.ok(publishCall);
    assert.deepStrictEqual(publishCall.args, [
      'users.cf.add-to-access-list',
      { remoteip: '8.8.8.8' },
      { confirm: true, mandatory: true },
    ]);
  });
});

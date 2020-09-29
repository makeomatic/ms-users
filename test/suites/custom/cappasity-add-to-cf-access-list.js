const assert = require('assert');
const sinon = require('sinon');

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

    service = await global.startService.call(this, {
      cfList: { enabled: true, worker: { enabled: false } },
      hooks: {
        'user:login': hook,
      },
    });

    const amqpStub = sandbox.stub(service.amqp, 'publish');

    amqpStub.withArgs('users.cf.add-to-list').resolves();
    amqpStub.callThrough();

    await service.dispatch('register', { params: userData });
  });

  afterEach('reset stub history', () => {
    sandbox.resetHistory();
  });

  after('stop', async () => {
    await global.clearRedis.call(this);
  });

  it('should not call `cf.add-to-list` if `plan` is `free`', async () => {
    await this.dispatch('users.login', { username, password, audience, remoteip: '8.8.8.8' });
    assert.strictEqual(service.amqp.publish.called, false, 'should not be called');
  });

  it('should call `cf.add-to-list` if `plan` is not `free`', async () => {
    await this.dispatch('users.updateMetadata', {
      username,
      audience: [audience],
      metadata: [{ $set: { plan: 'enterprise' } }],
    });

    await this.dispatch('users.login', { username, password, audience, remoteip: '8.8.8.8' });
    const [publishCall] = service.amqp.publish.getCalls();
    assert.ok(publishCall);
    assert.deepStrictEqual(publishCall.args, ['users.cf.add-to-list', { remoteip: '8.8.8.8' }]);
  });
});

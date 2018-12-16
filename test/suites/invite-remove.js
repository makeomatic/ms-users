const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#invite-remove', function registerSuite() {
  before(global.startService);
  after(global.clearRedis);

  const email = 'v@yandex.ru';

  before('must be able to create invitation', function test() {
    return this
      .dispatch('users.invite', {
        email,
        ctx: {
          firstName: 'Alex',
          lastName: 'Bon',
        },
        metadata: {
          '*.localhost': {
            plan: 'premium',
            vip: true,
          },
        },
      })
      .reflect()
      .then(inspectPromise());
  });

  it('must be able to remove invite', function test() {
    return this
      .dispatch('users.invite-remove', { id: email })
      .reflect()
      .then(inspectPromise());
  });

  it('must reject removing non-existing invite', async function test() {
    const err = await this
      .dispatch('users.invite-remove', { id: email })
      .reflect()
      .then(inspectPromise(false));

    assert.equal(err.name, 'HttpStatusError', err.message);
    assert.equal(err.message, `Invite with id "${email}" not found`);
  });
});

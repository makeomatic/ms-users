const { strict: assert } = require('assert');
const { startService, clearRedis } = require('../../config');

describe('#invite-remove', function registerSuite() {
  before(startService);
  after(clearRedis);

  const email = 'v@yandex.ru';

  before('must be able to create invitation', function test() {
    return this
      .users
      .dispatch('invite', { params: {
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
      } });
  });

  it('must be able to remove invite', function test() {
    return this
      .users
      .dispatch('invite-remove', { params: { id: email } });
  });

  it('must reject removing non-existing invite', async function test() {
    await assert.rejects(this.users.dispatch('invite-remove', { params: { id: email } }), {
      name: 'HttpStatusError',
      message: `Invite with id "${email}" not found`,
    });
  });
});

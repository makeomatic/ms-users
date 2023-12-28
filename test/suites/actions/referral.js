const assert = require('node:assert/strict');
const { startService, clearRedis } = require('../../config');

describe('#referral', function registerSuite() {
  before(startService);
  after(clearRedis);

  const exampleHash = 'i-know-referrals-dot-com';
  const referralId = '00000001';
  const referralName = 'Inviter';

  it('captures referral', function test() {
    return this.users.dispatch('referral', { params: {
      id: exampleHash,
      referral: referralId,
      metadata: { name: referralName },
    } })
      .then((result) => {
        assert.deepEqual(result, ['OK', 1, 'OK']);
      });
  });

  it('does not capture referral if already present', function test() {
    return this.users.dispatch('referral', { params: {
      id: exampleHash,
      referral: referralId,
    } })
      .then((result) => {
        assert.deepEqual(result, [null]);
      });
  });

  it('picks up referral if present during registration call', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      alias: 'subtle',
      metadata: {
        service: 'craft',
      },
      referral: exampleHash,
    };

    return this.users.dispatch('register', { params: { ...opts } })
      .then((registered) => {
        assert.equal(registered.user.metadata[opts.audience].referral, referralId);
        assert.equal(registered.user.metadata[opts.audience].referralMeta.name, referralName);
      });
  });

  it('isReferral returns false on invalid referral code', function test() {
    const opts = {
      username: 'subtle',
      referralCode: 'vasya',
    };

    return this.users.dispatch('isReferral', { params: opts })
      .then((response) => {
        assert.equal(response, false);
      });
  });

  it('isReferral returns username on valid referral code', function test() {
    const opts = {
      username: 'subtle',
      referralCode: referralId,
    };

    return this.users.dispatch('isReferral', { params: opts })
      .then((response) => {
        assert.ok(/^\d+$/.test(response));
      });
  });
});

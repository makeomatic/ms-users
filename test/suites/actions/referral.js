/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');

describe('#referral', function registerSuite() {
  before(global.startService);
  after(global.clearRedis);

  const exampleHash = 'i-know-referrals-dot-com';
  const referralId = '00000001';
  const referralName = 'Inviter';

  it('captures referral', function test() {
    return this.dispatch('users.referral', {
      id: exampleHash,
      referral: referralId,
      metadata: { name: referralName },
    })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        assert.deepEqual(result, ['OK', 1, 'OK']);
      });
  });

  it('does not capture referral if already present', function test() {
    return this.dispatch('users.referral', {
      id: exampleHash,
      referral: referralId,
    })
      .reflect()
      .then(inspectPromise())
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

    return this.dispatch('users.register', { ...opts })
      .reflect()
      .then(inspectPromise())
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

    return this.dispatch('users.isReferral', opts)
      .reflect()
      .then(inspectPromise())
      .then((response) => {
        assert.equal(response, false);
      });
  });

  it('isReferral returns username on valid referral code', function test() {
    const opts = {
      username: 'subtle',
      referralCode: referralId,
    };

    return this.dispatch('users.isReferral', opts)
      .reflect()
      .then(inspectPromise())
      .then((response) => {
        assert.ok(/^\d+$/.test(response));
      });
  });
});

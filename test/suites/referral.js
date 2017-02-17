/* eslint-disable promise/always-return, no-prototype-builtins */
/* global inspectPromise */
const assert = require('assert');

describe('#referral', function registerSuite() {
  before(global.startService);
  after(global.clearRedis);

  const exampleHash = 'i-know-referrals-dot-com';
  const referralId = '00000001';

  it('captures referral', function test() {
    return this.dispatch('users.referral', {
      id: exampleHash,
      referral: referralId,
    })
    .reflect()
    .then(inspectPromise())
    .then((result) => {
      assert.equal(result, 'OK');
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
      assert.equal(result, null);
    });
  });

  it('picks up referral if present during registration call', function test() {
    const opts = {
      username: 'v@makeomatic.ru',
      password: 'mynicepassword',
      audience: 'matic.ninja',
      metadata: {
        service: 'craft',
      },
      referral: exampleHash,
    };

    return this.dispatch('users.register', opts)
      .reflect()
      .then(inspectPromise())
      .then((registered) => {
        assert.equal(registered.user.metadata[opts.audience].referral, referralId);
      });
  });
});

/* global inspectPromise */
const simpleDispatcher = require('./../helpers/simpleDispatcher');
const assert = require('assert');

describe('#invite-remove', function registerSuite() {
  before(global.startService);
  after(global.clearRedis);

  const email = 'v@yandex.ru';

  before(function init() {
    this.dispatch = simpleDispatcher(this.users.router);
  });

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

  it('must reject removing non-existing invite', function test() {
    return this
      .dispatch('users.invite-remove', { id: email })
      .reflect()
      .then(inspectPromise(false))
      .then(err => {
        assert.equal(err.name, 'HttpStatusError');
        assert.equal(err.message, `Invite with id "${email}" not found`);
        return null;
      });
  });
});

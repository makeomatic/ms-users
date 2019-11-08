/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');

const InactiveUsers = require('../../src/utils/inactive-user/inactive-user');
const { createOrganization } = require('../helpers/organization');

describe('#inactive user', function registerSuite() {
  beforeEach(global.startService.bind(this));
  afterEach(global.clearRedis.bind(this));

  const regUser = {
    username: 'v@makeomatic.ru',
    audience: 'matic.ninja',
    alias: 'bondthebest',
    activate: false,
    metadata: {
      service: 'craft',
    },
    // eslint-disable-next-line max-len
    sso: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJtcy11c2VycyIsInByb2ZpbGUiOnsiZDEiOjEyLCJubSI6InBhaiJ9LCJpbnRlcm5hbHMiOnsidWlkIjoxNTE2MjM5MDIyfSwicHJvdmlkZXIiOiJmYWNlYm9vayIsInVpZCI6MTUxNjIzOTAyMiwidXNlcm5hbWUiOiJmb29AYmFyLmJheiJ9.QXLcP-86A3ly-teJt_C_XQo3hFUVC0pVALb84Eitozo',
  };

  const regUserNoAlias = {
    username: 'v2@makeomatic.ru',
    audience: 'matic.log',
    activate: false,
    metadata: {
      service: 'log',
    },
  };

  beforeEach(async () => {
    this.users.config.deleteInactiveAccounts = 1;

    await createOrganization.call(this);
    await this.dispatch('users.register', { ...regUser });
    await this.dispatch('users.register', { ...regUserNoAlias });
  });

  it('deletes inactive user', async () => {
    const inactiveUsers = new InactiveUsers(this.users);
    await Promise.delay(1000);

    await inactiveUsers.deleteInactive(1);

    const { username } = regUser;
    await this.dispatch('users.getInternalData', { username })
      .reflect()
      .then(inspectPromise(false));
  });
});

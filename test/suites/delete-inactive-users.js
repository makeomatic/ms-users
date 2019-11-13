/* eslint-disable promise/always-return, no-prototype-builtins */
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const faker = require('faker');
const ld = require('lodash');
const { expect } = require('chai');
const InactiveUsers = require('../../src/utils/user/inactive-user');
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
    await createOrganization.call(this);
    await this.dispatch('users.register', { ...regUser });
    await this.dispatch('users.register', { ...regUserNoAlias });
  });

  it('deletes inactive user', async () => {
    const inactiveUsers = new InactiveUsers(this.users);
    await Promise.delay(1000);

    await inactiveUsers.cleanUsers(1);

    const { username } = regUser;
    await this.dispatch('users.getInternalData', { username })
      .reflect()
      .then(inspectPromise(false));
  });

  it('removes org member if user not passed activation', async () => {
    const opts = {
      organizationId: this.organization.id,
      member: {
        email: regUser.username,
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      },
    };

    const reqOpts = {
      organizationId: this.organization.id,
    };

    await this.dispatch('users.organization.members.add', opts);
    const inactiveUsers = new InactiveUsers(this.users);
    await Promise.delay(1200);

    await inactiveUsers.cleanUsers(1);

    const members = await this.dispatch('users.organization.members.list', reqOpts);
    const { attributes } = members.data;
    const membersWithUsername = ld.filter(attributes, (record) => {
      return record.id === regUser.username;
    });
    expect(membersWithUsername.length).to.be.eq(0);
  });
});

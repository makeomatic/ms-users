const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const assert = require('assert');
const times = require('lodash/times');
const faker = require('faker');

describe('#invite', function registerSuite() {
  before(global.startService);
  after(global.clearRedis);

  const {
    TOKEN_METADATA_FIELD_METADATA,
    TOKEN_METADATA_FIELD_SENDED_AT,
    TOKEN_METADATA_FIELD_CONTEXT,
  } = require('../../src/constants.js');

  before(function init() {
    return Promise.all(times(100, (n) => this.dispatch('users.invite', {
      email: `${n}@yandex.ru`,
      ctx: {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName(),
      },
      metadata: {
        '*.localhost': {
          company: faker.company.companyName(),
        },
      },
    })));
  });

  it('returns expanded list of issued invites', function test() {
    return this
      .dispatch('users.invite-list', {
        criteria: 'id',
      })
      .reflect()
      .then(inspectPromise())
      .then((result) => {
        assert.equal(result.invites.length, 10);
        assert.equal(result.pages, 10);
        assert.equal(result.page, 1);

        result.invites.forEach((invite) => {
          assert(invite.created);
          assert(invite.id);
          assert(invite.action);
          assert(invite.secret);
          assert(invite.metadata[TOKEN_METADATA_FIELD_METADATA]['*.localhost'].company);
          assert(invite.metadata[TOKEN_METADATA_FIELD_SENDED_AT]);
          assert(invite.metadata[TOKEN_METADATA_FIELD_CONTEXT].firstName);
          assert(invite.metadata[TOKEN_METADATA_FIELD_CONTEXT].lastName);
          assert(invite.uid);
          assert.ifError(invite.ctx);
        });

        return null;
      });
  });
});

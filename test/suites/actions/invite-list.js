const Promise = require('bluebird');
const assert = require('node:assert/strict');
const times = require('lodash/times');
const { faker } = require('@faker-js/faker');
const { startService, clearRedis } = require('../../config');

describe('#invite', function registerSuite() {
  before(startService);
  after(clearRedis);

  const {
    TOKEN_METADATA_FIELD_METADATA,
    TOKEN_METADATA_FIELD_SENDED_AT,
    TOKEN_METADATA_FIELD_CONTEXT,
  } = require('../../../src/constants');

  before(function init() {
    return Promise.all(times(100, (n) => this.users.dispatch('invite', { params: {
      email: `${n}@yandex.ru`,
      ctx: {
        firstName: faker.person.firstName(),
        lastName: faker.person.lastName(),
      },
      metadata: {
        '*.localhost': {
          company: faker.company.name(),
        },
      },
    } })));
  });

  it('returns expanded list of issued invites', function test() {
    return this
      .users
      .dispatch('invite-list', { params: { criteria: 'id' } })
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

const assert = require('node:assert/strict');
const path = require('path');
const exec = require('../../helpers/exec');
const { startService, clearRedis } = require('../../config');

describe('binary: batch-register', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../src/bin/batch-register.js');

  before(startService);
  after(clearRedis);

  it('allows to register batch users from stdin', async () => {
    const input = {
      common: {
        roles: ['dj'],
        extra: 'method',
        param: true,
      },
      users: [
        'Vitaly Makeomatic test@makeomatic.ru',
        ['Anthony', 'Jacobs', 'monarch@makeomatic.ru'],
      ],
    };

    const stdout = await exec(`echo '${JSON.stringify(input)}' | ${binaryPath}`);

    const users = stdout.split('\n');
    assert.equal(users[0].indexOf('[test@makeomatic.ru] - '), 0, JSON.stringify(users));
    assert.equal(users[1].indexOf('[monarch@makeomatic.ru] - '), 0, JSON.stringify(users));
  });
});

const { strict: assert } = require('assert');
const path = require('path');
const exec = require('../../helpers/exec');

describe('binary: batch-register', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../bin/batch-register.js');

  before(global.startService);
  after(global.clearRedis);

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

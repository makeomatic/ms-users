const assert = require('assert');
const path = require('path');
const exec = require('../../helpers/exec');

describe('binary: password', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../bin/password.js');
  const uid = 'test@test.me';
  const newPassword = 'trickynewpassword';

  before(global.startService);
  before(() => global.globalRegisterUser(uid, {
    inactive: false,
  }));
  after(global.clearRedis);

  it('allows updating password from the command-line', async () => {
    await exec(`${binaryPath} ${uid} ${newPassword}`);

    // Verify trying to log in with the new password
    // unset jwt token just in case
    this.jwt = null;
    // eslint-disable-next-line no-undef
    await globalAuthUser(uid, newPassword);
    assert(this.jwt);
  });
});

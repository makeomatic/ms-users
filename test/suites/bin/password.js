const assert = require('assert');
const path = require('path');
const exec = require('../../helpers/exec');

describe('binary: password', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../bin/password.js');
  const username = 'test@test.me';
  const newPassword = 'trickynewpassword';
  // eslint-disable-next-line no-undef
  const checkAuth = globalAuthUser(username, newPassword);

  before(global.startService);
  before(global.globalRegisterUser(username, {
    inactive: false,
  }));
  // eslint-disable-next-line no-undef
  before(globalAuthUser(username));
  after(global.clearRedis);

  it('allows updating password from the command-line', async function test() {
    await exec(`${binaryPath} ${this.userId} ${newPassword}`);
    // Verify trying to log in with the new password
    // unset jwt token just in case
    this.jwt = null;
    // eslint-disable-next-line no-undef
    await checkAuth.call(this);
    assert(this.jwt);
  });
});

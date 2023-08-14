const { strict: assert } = require('assert');
const path = require('path');
const exec = require('../../helpers/exec');
const { startService, clearRedis, globalRegisterUser, globalAuthUser } = require('../../config');

describe('binary: password', function suite() {
  const binaryPath = path.resolve(__dirname, '../../../src/bin/password.js');
  const username = 'test@test.me';
  const newPassword = 'trickynewpassword';

  const checkAuth = globalAuthUser(username, newPassword);

  before(startService);
  before(globalRegisterUser(username, {
    inactive: false,
  }));

  before(globalAuthUser(username));
  after(clearRedis);

  it('allows updating password from the command-line', async function test() {
    await exec(`${binaryPath} ${this.userId} ${newPassword}`);
    // Verify trying to log in with the new password
    // unset jwt token just in case
    this.jwt = null;

    await checkAuth.call(this);
    assert(this.jwt);
  });
});

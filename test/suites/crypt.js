const assert = require('assert');

describe('encrypt/decrypt suite', function cryptoSuite() {
  const crypto = require('../../src/utils/tokens/crypto.js');

  // beforeEach(global.startService);
  // afterEach(global.clearRedis);

  it('must be able to encode and then decode token', function test() {
    const { algorithm, secret } = this.users._config.validation;
    const email = 'v@example.com';
    const secretWord = 'super-secret';

    const token = crypto.safeEncode(algorithm, secret, email, secretWord);
    assert.notEqual(token, JSON.stringify({ id: email, token }));

    const decrypted = crypto.safeDecode(algorithm, secret, token);
    assert.equalDeep(decrypted, { id: email, token });
  });
});

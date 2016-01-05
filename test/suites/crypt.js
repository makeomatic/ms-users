const { expect } = require('chai');

describe('encrypt/decrypt suite', function cryptoSuite() {
  const emailValidation = require('../../lib/utils/send-email.js');

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('must be able to encode and then decode token', function test() {
    const { algorithm, secret } = this.users._config.validation;
    const obj = { email: 'v@example.com', secret: 'super-secret' };
    const message = new Buffer(JSON.stringify(obj));
    const token = emailValidation.encrypt(algorithm, secret, message);
    expect(token).to.not.be.equal(JSON.stringify(obj));
    const decrypted = emailValidation.decrypt(algorithm, secret, token);
    expect(decrypted.toString()).to.be.eq(JSON.stringify(obj));
    expect(JSON.parse(decrypted)).to.be.deep.eq(obj);
  });
});

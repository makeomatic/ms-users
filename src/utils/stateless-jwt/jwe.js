const { assert } = require('@hapi/hoek');
const jose = require('jose');

const getKeyId = (token, keyId) => {
  const tokenHeader = jose.decodeProtectedHeader(token);
  return keyId || tokenHeader.kid;
};

class JoseWrapper {
  constructor(config) {
    this.config = config;
    this.keys = new Map();
  }

  async getKey(kid = null) {
    if (this.keys.has(kid)) {
      return this.keys.get(kid);
    }

    return this.defaultKey;
  }

  async init() {
    const promises = this.config.jwk.map(async ({ defaultKey, ...jwk }) => {
      const importedKey = await jose.importJWK(jwk);
      const keyStoreValue = { kid: jwk.kid, key: importedKey };

      this.keys.set(jwk.kid, keyStoreValue);

      if (defaultKey) {
        this.defaultKey = keyStoreValue;
      }
    });

    await Promise.all(promises);

    assert(this.defaultKey, 'One of the keys should be default');
  }

  async encrypt(payload, keyId = null) {
    const { cypher } = this.config;
    const { kid, key } = await this.getKey(keyId);

    const encoder = new jose.EncryptJWT(payload)
      .setProtectedHeader({ ...cypher, kid });

    return encoder.encrypt(key);
  }

  async decrypt(token, params = {}, kid = null) {
    const keyId = getKeyId(token, kid);
    const { key } = await this.getKey(keyId);

    return jose.jwtDecrypt(token, key, params);
  }

  async verify(token, params = {}, kid = null) {
    const keyId = getKeyId(token, kid);
    const { key } = await this.getKey(keyId);

    return jose.jwtVerify(token, key, params);
  }

  static isJweToken(token) {
    return token.split('.').length === 5;
  }
}

module.exports = { JoseWrapper };

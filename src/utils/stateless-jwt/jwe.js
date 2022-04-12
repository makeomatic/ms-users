const { assert } = require('@hapi/hoek');
const jose = require('jose');

class JoseWrapper {
  constructor(config) {
    this.config = config;
    this.keys = new Map();
  }

  async getKey(kid = null) {
    console.debug(this);
    if (this.keys.has(kid)) {
      return this.keys.get(kid);
    }

    return this.defaultKey;
  }

  async init() {
    const promises = this.config.jwk.map(async ({ defaultKey, ...jwk }) => {
      const importedKey = await jose.importJWK(jwk);
      this.keys.set(jwk.kid, importedKey);
      if (defaultKey) {
        this.defaultKey = importedKey;
      }
    });

    await Promise.all(promises);

    assert(this.defaultKey, 'One of the keys should be default');
  }

  async encrypt(payload, kid = null) {
    const { cypher, jwk } = this.config;
    const key = await this.getKey(kid);
    const encoder = new jose.EncryptJWT(payload);

    encoder.setProtectedHeader({
      ...cypher,
      kid: jwk.kid,
    });

    return encoder.encrypt(key);
  }

  async decrypt(data, params = {}, kid = null) {
    const key = await this.getKey(kid);
    return jose.jwtDecrypt(data, key, params);
  }

  async verify(token, params = {}, kid = null) {
    const key = await this.getKey(kid);
    return jose.jwtVerify(token, key, params);
  }

  static isJweToken(token) {
    return token.split('.').length === 5;
  }
}

module.exports = { JoseWrapper };

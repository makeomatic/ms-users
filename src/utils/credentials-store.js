const { USERS_INVALID_TOKEN } = require('../constants');

class CredentialsStore {
  constructor(amqp, config) {
    this.amqp = amqp;
    this.config = config;
  }

  async getKey(keyId) {
    const { tokenGet, timeouts: { tokenGet: timeout } } = this.config;
    const [username, uuid] = keyId.split('.');
    try {
      const { raw } = await this.amqp.publishAndWait(
        tokenGet,
        { username, token: uuid, sensitive: true },
        { timeout }
      );

      return raw;
    } catch (e) {
      throw USERS_INVALID_TOKEN;
    }
  }

  async getCredentials(keyId, audience) {
    const { apiTokenVerify, timeouts: { apiTokenVerify: timeout } } = this.config;
    const [username, uuid] = keyId.split('.');

    return this.amqp.publishAndWait(
      apiTokenVerify,
      { username, uuid, audience },
      { timeout }
    );
  }
}

module.exports = {
  CredentialsStore,
};

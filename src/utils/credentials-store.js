class CredentialsStore {
  constructor(amqp, config) {
    this.amqp = amqp;
    this.config = config;
  }

  async getKey(keyId) {
    const { getToken, timeouts: { getToken: timeout } } = this.config;
    const [username, uuid] = keyId.split('.');

    const { raw } = await this.amqp.publishAndWait(
      getToken,
      { username, token: uuid, sensitive: true },
      { timeout }
    );

    return raw;
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

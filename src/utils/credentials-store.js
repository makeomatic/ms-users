const { USERS_INVALID_TOKEN } = require('../constants');

/**
 * @typedef { import("@microfleet/transport-amqp").AMQPTransport } AMQPTransport
 * @typedef { import("@microfleet/transport-amqp").Publish } PublishOptions
 *
 * @typedef {object} CredentialsStoreConfig
 * @property {string} tokenGet - route for tokenGet
 * @property {string} apiTokenVerify - route for token verify
 * @property {object} timeouts - contains timeouts
 * @property {number} timeouts.tokenGet
 * @property {number} timeouts.apiTokenVerify
 * @property {object} publishOptions
 * @property {PublishOptions} publishOptions.tokenGet
 * @property {PublishOptions} publishOptions.apiTokenVerify
 */

/**
 * @class CredentialsStore
 */
class CredentialsStore {
  /**
   * @constructor
   * @param {AMQPTransport} amqp
   * @param {CredentialsStoreConfig} config
   */
  constructor(amqp, config) {
    /**
     * @type {AMQPTransport}
     * @private
     */
    this.amqp = amqp;

    /**
     * @type {CredentialsStoreConfig}
     * @private
     */
    this.config = config;

    const { timeouts = {}, publishOptions = {} } = config;

    /**
     * @type {CredentialsStoreConfig['publishOptions']}
     * @private
     */
    this.cachedOptions = {
      tokenGet: { timeout: timeouts.tokenGet, ...publishOptions.tokenGet },
      apiTokenVerify: { timeout: timeouts.apiTokenVerify, ...publishOptions.apiTokenVerify },
    };
  }

  async getKey(keyId) {
    const { tokenGet, cachedOptions: { tokenGet: publishOptions } } = this.config;
    const [username, uuid] = keyId.split('.');
    try {
      const { raw } = await this.amqp
        .publishAndWait(tokenGet, { username, token: uuid, sensitive: true }, publishOptions);

      return raw;
    } catch (e) {
      throw USERS_INVALID_TOKEN;
    }
  }

  getCredentials(keyId, audience) {
    const { apiTokenVerify, cachedOptions: { apiTokenVerify: publishOptions } } = this.config;
    const [username, uuid] = keyId.split('.');

    return this.amqp.publishAndWait(apiTokenVerify, { username, uuid, audience }, publishOptions);
  }
}

module.exports = {
  CredentialsStore,
};

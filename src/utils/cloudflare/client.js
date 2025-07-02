const assert = require('node:assert/strict');
const got = require('got');

const API_URL = 'https://api.cloudflare.com/client/v4/';

const has = (obj, prop) => Object.hasOwnProperty.call(obj, prop);

class CloudflareClient {
  constructor(opts) {
    assert(typeof opts === 'object', 'configuration required');

    this.client = got.extend({
      headers: CloudflareClient.getHeaders(opts),
      prefixUrl: API_URL,
      responseType: 'json',
      resolveBodyOnly: true,
    });
  }

  getHttpClient() {
    return this.client;
  }

  static getHeaders(connectionOpts) {
    if (has(connectionOpts, 'token')) {
      const { token } = connectionOpts;
      return {
        Authorization: `Bearer ${token}`,
      };
    }

    if (has(connectionOpts, 'serviceKey')) {
      const { serviceKey } = connectionOpts;
      return {
        'X-Auth-User-Service-Key': serviceKey,
      };
    }

    if (has(connectionOpts, 'key')) {
      assert(connectionOpts.email, 'email should be set');
      const { email, key } = connectionOpts;
      return {
        'X-Auth-Email': email,
        'X-Auth-Key': key,
      };
    }

    throw new Error('invalid configuration');
  }
}

module.exports = {
  CloudflareClient,
};

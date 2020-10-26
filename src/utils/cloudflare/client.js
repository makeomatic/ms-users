const assert = require('assert');
const got = require('got');
const { helpers: { generateClass } } = require('common-errors');

const API_URL = 'https://api.cloudflare.com/client/v4/';

// https://api.cloudflare.com/#getting-started-responses
const CfAPIError = generateClass('CfAPIError', {
  args: ['messages', 'errors'],
  generateMessage() {
    const errors = this.errors ? this.errors.map((e) => `[${e.code}] ${e.message}`) : '';
    const messages = this.messages ? ` Messages: ${this.messages.join(',')}` : '';
    const message = `${errors}${messages}`;
    return `CfApiError: ${message}`;
  },
});

const has = (obj, prop) => Object.hasOwnProperty.call(obj, prop);

class CloudflareClient {
  constructor(opts) {
    assert(typeof opts === 'object', 'configuration required');

    this.client = got.extend({
      headers: CloudflareClient.getHeaders(opts),
      prefixUrl: API_URL,
      responseType: 'json',
      resolveBodyOnly: true,
      hooks: {
        afterResponse: [CloudflareClient.processResponse],
      },
    });
  }

  getHttpClient() {
    return this.client;
  }

  static processResponse(response) {
    const { body } = response;
    if (body.success === false) {
      throw new CfAPIError(body.messages, body.errors);
    }
    return response;
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
  CfAPIError,
};

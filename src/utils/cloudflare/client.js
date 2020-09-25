const { assert } = require('chai');
const got = require('got');
const { helpers: { generateClass } } = require('common-errors');

const API_URL = 'https://api.cloudflare.com/client/v4/';
const CF_ERROR = generateClass('CfAPIError', { args: ['messages', 'errors'] });

const has = (obj, prop) => Object.getOwnPropertyNames(obj).includes(prop);

class CloudflareClient {
  constructor(opts) {
    this.client = got.extend({
      headers: CloudflareClient.getHeaders(opts),
      prefixUrl: API_URL,
      responseType: 'json',
      resolveBodyOnly: true,
      hooks: {
        afterResponse: [CloudflareClient.processResponse],
        beforeError: [(e) => {
          e.url = e.request.requestUrl;
          return e;
        }],
      },
    });
  }

  static processResponse(response) {
    if (response.success === false) {
      throw new CF_ERROR(response.messages, response.errors);
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
      assert(connectionOpts.email, 'should provide email');
      const { email, key } = connectionOpts;
      return {
        'X-Auth-Email': email,
        'X-Auth-Key': key,
      };
    }
    const { token } = connectionOpts;
    return {
      'X-Auth-Token': token,
    };
  }
}

module.exports = {
  CloudflareClient,
  CF_ERROR,
};

const assert = require('node:assert/strict');
const nock = require('nock');

const { CloudflareClient } = require('../../../../src/utils/cloudflare/client');

describe('Cloudflare client', () => {
  let scope;

  before(() => {
    scope = nock('https://api.cloudflare.com/client/v4/')
      .persist()
      .get(/some\/url/)
      .reply(200, function response(url, body, cb) {
        cb(null, { headers: this.req.headers, body, url });
      });
  });

  after(() => {
    scope.done();
    nock.restore();
  });

  it('should use `token`', async () => {
    const cf = new CloudflareClient({
      token: 'mysecrettoken',
    });

    const { headers, url } = await cf.client.get('some/url');
    assert.strictEqual(headers.authorization, 'Bearer mysecrettoken');
    assert.strictEqual(headers.host, 'api.cloudflare.com');
    assert.strictEqual(url, '/client/v4/some/url');
  });

  it('should use `serviceKey`', async () => {
    const cf = new CloudflareClient({
      serviceKey: 'myservicekey',
    });

    const { headers, url } = await cf.client.get('some/url');
    assert.strictEqual(headers['x-auth-user-service-key'], 'myservicekey');
    assert.strictEqual(headers.host, 'api.cloudflare.com');
    assert.strictEqual(url, '/client/v4/some/url');
  });

  it('should use `email + key`', async () => {
    const cf = new CloudflareClient({
      email: 'foo@email.com',
      key: 'secretaccountkey',
    });

    const { headers, url } = await cf.client.get('some/url');
    assert.strictEqual(headers['x-auth-email'], 'foo@email.com');
    assert.strictEqual(headers['x-auth-key'], 'secretaccountkey');
    assert.strictEqual(headers.host, 'api.cloudflare.com');
    assert.strictEqual(url, '/client/v4/some/url');
  });

  it('should panic on missing `key`', () => {
    assert.throws(() => {
      // eslint-disable-next-line no-unused-vars
      const client = new CloudflareClient({
        key: 'secretaccountkey',
      });
    }, /email should be set/);
  });

  /* eslint-disable no-unused-vars */
  it('should panic when none of the options provided', () => {
    assert.throws(() => {
      const client = new CloudflareClient({});
    }, /invalid configuration/);
  });

  it('should panic when config not passed', () => {
    assert.throws(() => {
      const client = new CloudflareClient();
    }, /configuration required/);
  });
  /* eslint-enable no-unused-vars */
});

const Promise = require('bluebird');
const { strict: assert } = require('assert');
const request = require('request-promise').defaults({
  uri: 'https://ms-users.local/users/_/me',
  json: true,
  gzip: true,
  simple: true,
  strictSSL: false,
});

describe('/_/me', function verifySuite() {
  beforeEach(global.startService);
  afterEach(global.clearRedis);

  it('invalid signature', async function test() {
    await assert.rejects(request.get({
      headers: {
        authorization: 'Signature sskdd',
      },
    }), {
      error: {
        name: 'HttpStatusError',
        message: 'invalid token',
        error: 'Forbidden',
        statusCode: 403,
      },
      statusCode: 403,
    });
  });

  it('supports valid signature', async function test() {
    
  })
});

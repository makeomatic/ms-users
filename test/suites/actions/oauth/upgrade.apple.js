const request = require('request-promise');

const Users = require('../../../../src');

// @TODO stub
describe('oauth.upgrade action', function suite() {
  const service = new Users({ oauth: { providers: { apple: { enabled: true } } } });

  before(() => service.connect());
  after(() => service.close());

  it('should be able to upgrade apple grand code', async () => {
    const response = await request({
      method: 'POST',
      uri: 'https://ms-users.local/users/oauth/upgrade',
      body: {
        provider: 'apple',
        token: 'c75da8efcf25f4acb80e51152fead9fad.0.srqty.7-k4X-G9bBesI_9hDFH6Xg',
      },
      json: true,
      strictSSL: false,
    });

    // @TODO assert
  });
});

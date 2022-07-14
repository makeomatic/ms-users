const { strictEqual } = require('assert');

const { Client } = require('undici');
const { stub, match } = require('sinon');

const Users = require('../../../../src');
const appleStrategy = require('../../../../src/auth/oauth/strategies/apple');

describe('oauth.upgrade action', function suite() {
  const service = new Users({ oauth: { providers: { apple: { enabled: true } } } });
  const client = new Client('https://ms-users.local', {
    tls: {
      rejectUnauthorized: false,
    },
  });

  before(() => service.connect());
  after(() => service.close());

  it('should be able to upgrade apple grand code', async () => {
    const clientSecretStub = stub(service.hapi.app.oauthProviderSettings.apple, 'clientSecret');
    // @TODO getProfile stub (needs refactor)
    // const appleStrategyStub = stub(appleStrategy, 'upgradeAppleCode');

    clientSecretStub
      .withArgs('com.test.app')
      .returns('CLIENT_SECRET');
    // appleStrategyStub
    //   .withArgs(
    //     match(
    //       (params) => params.code === 'c75da8efcf25f4acb80e51152fead9fad.0.srqty.7-k4X-G9bBesI_9hDFH6Xg'
    //         && params.redirectUrl === 'https://ms-users.local/users/oauth/apple'
    //         && params.providerSettings.appId === 'com.test.app'
    //     )
    //   )
    //   .resolves({
    //     access_token: 'adg61...67Or9',
    //     token_type: 'Bearer',
    //     expires_in: 3600,
    //     refresh_token: 'rca7...lABoQ',
    //     id_token: 'eyJra...96sZg',
    //     email: 'k9mj4sq2rc@privaterelay.appleid.com',
    //     profile: {
    //       id: '001038.f470322604c14e328f912ca1182c8ff5.1028',
    //       email: 'k9mj4sq2rc@privaterelay.appleid.com',
    //     },
    //     internals: {
    //       email: 'k9mj4sq2rc@privaterelay.appleid.com',
    //       emailVerified: true,
    //       isPrivateEmail: true,
    //       id: '001038.f470322604c14e328f912ca1182c8ff5.1028',
    //       accessToken: 'adg61...67Or9',
    //       idToken: 'eyJra...96sZg',
    //       refreshToken: 'rca7...lABoQ',
    //       tokenType: 'Bearer',
    //       expiresIn: 3600,
    //     },
    //     query: {},
    //   });

    const response = await client.request({
      method: 'POST',
      path: '/users/oauth/upgrade',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'apple',
        token: 'c75da8efcf25f4acb80e51152fead9fad.0.srqty.7-k4X-G9bBesI_9hDFH6Xg',
      }),
    });

    const data = await response.body.json();

    strictEqual(data.payload.token !== undefined, true);
    strictEqual(data.payload.provider, 'apple');
    strictEqual(data.error, false);
    strictEqual(data.type, 'ms-users:signed');
    strictEqual(data.title, 'Attached apple account');

    clientSecretStub.restore();
    // appleStrategyStub.restore();
  });
});

const { strict: assert, strictEqual } = require('assert');
const { decodeJwt } = require('jose');
const request = require('request-promise');
const Bell = require('@hapi/bell');

const Users = require('../../../../src');

describe('sign in with apple', function suite() {
  let service;

  afterEach(async () => {
    await service?.close();
  });

  it('should be able to redirect to sign in (init sign in and redirect to apple.com)', async () => {
    // it's here because of Bell.simulate
    service = new Users({ oauth: { providers: { apple: { enabled: true } } } });
    await service.connect();

    const { headers } = await request.get('https://ms-users.local/users/oauth/apple', {
      strictSSL: false,
      followRedirect: false,
      simple: false,
      resolveWithFullResponse: true,
    });

    assert(headers.location !== undefined);

    const redirectUri = new URL(headers.location);

    strictEqual(redirectUri.origin, 'https://appleid.apple.com');
    strictEqual(redirectUri.pathname, '/auth/authorize');
    strictEqual(redirectUri.hash, '');
    strictEqual(redirectUri.searchParams.get('response_mode'), 'form_post');
    strictEqual(redirectUri.searchParams.get('response_type'), 'code');
    strictEqual(redirectUri.searchParams.get('client_id'), 'com.test.service');
    strictEqual(redirectUri.searchParams.get('redirect_uri'), 'https://ms-users.local/users/oauth/apple');
    strictEqual(redirectUri.searchParams.get('scope'), 'name email');
    assert(redirectUri.searchParams.get('state') !== undefined);

    this.state = redirectUri.searchParams.get('state');
    // bell cookie
    [this.cookie] = headers['set-cookie'][0].split(';');
  });

  // depends on previous test
  it('should be able to returns from sign in (callback from apple.com with code)', async () => {
    Bell.simulate((req) => {
      // test POST params from apple to query string
      strictEqual(req.query.code, 'cd776798269fb4d2fb619fe5766b5a4a1.0.rrqty.9vb4ocSgzKC-b5DAAJM31g');
      strictEqual(req.query.state, this.state);

      return {
        provider: 'apple',
        query: {},
        token: 'ad689f12710404692c4bffa9ef023e12ba.0.rrqty.1d32aGYqz0u_f0QwKqTa9Q',
        refreshToken: 'r75ccdc22c4bffa9aa4e51c00ccf1920a.0.rrqty.0wKHuIDqK5UJ6QzCtFJhyQ',
        expiresIn: 3600,
        profile: {
          id: '001038.bcf9d759582c4bffa9da2c4bffa969c3.1543',
          email: 'q5skaas7cn@privaterelay.appleid.com',
          uid: 'apple:001038.bcf9d759582c4bffa9da2c4bffa969c3.1543',
        },
        internals: {
          email: 'q5skaas7cn@privaterelay.appleid.com',
          emailVerified: 'true',
          isPrivateEmail: 'true',
          id: '001038.bcf9d759582c4bffa9da2c4bffa969c3.1543',
          uid: 'apple:001038.bcf9d759582c4bffa9da2c4bffa969c3.1543',
        },
        uid: 'apple:001038.bcf9d759582c4bffa9da2c4bffa969c3.1543',
      };
    });

    service = new Users({ oauth: { providers: { apple: { enabled: true } } } });
    await service.connect();

    const response = await request.post('https://ms-users.local/users/oauth/apple', {
      form: {
        state: this.state,
        code: 'cd776798269fb4d2fb619fe5766b5a4a1.0.rrqty.9vb4ocSgzKC-b5DAAJM31g',
        user: '{"name":{"firstName":"Perchik","lastName":"The Cat"},"email":"q5skaas7cn@privaterelay.appleid.com"}',
      },
      headers: {
        cookie: this.cookie,
      },
      followRedirect: false,
      simple: false,
      resolveWithFullResponse: true,
      strictSSL: false,
    });

    // extract JSON from html response
    const body = JSON.parse(response.body.match(/{".+"}/)[0].replace('undefined', 'null'));
    const data = decodeJwt(body.payload.token);

    strictEqual(body.payload.provider, 'apple');
    strictEqual(body.error, false);
    strictEqual(body.type, 'ms-users:signed');
    strictEqual(body.title, 'Attached apple account');

    strictEqual(data.provider, 'apple');
    strictEqual(data.token, 'ad689f12710404692c4bffa9ef023e12ba.0.rrqty.1d32aGYqz0u_f0QwKqTa9Q');
    strictEqual(data.refreshToken, 'r75ccdc22c4bffa9aa4e51c00ccf1920a.0.rrqty.0wKHuIDqK5UJ6QzCtFJhyQ');
    strictEqual(data.expiresIn, 3600);
    strictEqual(data.profile.id, '001038.bcf9d759582c4bffa9da2c4bffa969c3.1543');
    strictEqual(data.profile.email, 'q5skaas7cn@privaterelay.appleid.com');
    strictEqual(data.profile.uid, 'apple:001038.bcf9d759582c4bffa9da2c4bffa969c3.1543');
    strictEqual(data.profile.displayName, 'Perchik The Cat');
    strictEqual(data.profile.name.first, 'Perchik');
    strictEqual(data.profile.name.last, 'The Cat');
    strictEqual(data.internals.email, 'q5skaas7cn@privaterelay.appleid.com');
    strictEqual(data.internals.emailVerified, 'true');
    strictEqual(data.internals.isPrivateEmail, 'true');
    strictEqual(data.internals.id, '001038.bcf9d759582c4bffa9da2c4bffa969c3.1543');
    strictEqual(data.internals.uid, 'apple:001038.bcf9d759582c4bffa9da2c4bffa969c3.1543');
    strictEqual(data.uid, 'apple:001038.bcf9d759582c4bffa9da2c4bffa969c3.1543');
    strictEqual(data.iss, 'ms-users');
    assert(data.iat !== undefined);
    assert(data.exp !== undefined);

    Bell.simulate(false);
  });

  it('should be able to return auth code (init sign in and redirect to apple.com)', async () => {
    // it's here because of Bell.simulate
    service = new Users({ oauth: { providers: { apple: { enabled: true } } } });
    await service.connect();

    const { headers } = await request.get('https://ms-users.local/users/oauth/apple?authCode=1', {
      strictSSL: false,
      followRedirect: false,
      simple: false,
      resolveWithFullResponse: true,
    });

    assert(headers.location !== undefined);

    const redirectUri = new URL(headers.location);

    strictEqual(redirectUri.origin, 'https://appleid.apple.com');
    strictEqual(redirectUri.pathname, '/auth/authorize');
    strictEqual(redirectUri.hash, '');
    strictEqual(redirectUri.searchParams.get('response_mode'), 'form_post');
    strictEqual(redirectUri.searchParams.get('response_type'), 'code');
    strictEqual(redirectUri.searchParams.get('client_id'), 'com.test.service');
    strictEqual(redirectUri.searchParams.get('redirect_uri'), 'https://ms-users.local/users/oauth/apple-code');
    strictEqual(redirectUri.searchParams.get('scope'), 'name email');
    assert(redirectUri.searchParams.get('state') !== undefined);

    this.state = redirectUri.searchParams.get('state');
    // bell cookie
    [this.cookie] = headers['set-cookie'][0].split(';');
  });

  // depends on previous test
  it('should be able to return auth code (callback from apple.com with code)', async () => {
    service = new Users({ oauth: { providers: { apple: { enabled: true } } } });
    await service.connect();

    const response = await request.post('https://ms-users.local/users/oauth/apple-code', {
      form: {
        state: this.state,
        code: 'cd776798269fb4d2fb619fe5766b5a4a1.0.rrqty.9vb4ocSgzKC-b5DAAJM31g',
        user: '{"name":{"firstName":"Perchik","lastName":"The Cat"},"email":"q5skaas7cn@privaterelay.appleid.com"}',
      },
      headers: {
        cookie: this.cookie,
      },
      followRedirect: false,
      simple: false,
      resolveWithFullResponse: true,
      strictSSL: false,
    });

    // extract JSON from html response
    const body = JSON.parse(response.body.match(/{".+"}/)[0].replace('undefined', 'null'));

    strictEqual(body.code, 'cd776798269fb4d2fb619fe5766b5a4a1.0.rrqty.9vb4ocSgzKC-b5DAAJM31g');
    strictEqual(body.user, '{"name":{"firstName":"Perchik","lastName":"The Cat"},"email":"q5skaas7cn@privaterelay.appleid.com"}');
  });
});

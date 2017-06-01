/* eslint-disable promise/always-return, no-prototype-builtins */
/* global inspectPromise, globalRegisterUser, globalAuthUser */

const Promise = require('bluebird');
const vm = require('vm');
const cheerio = require('cheerio');
const assert = require('assert');
const forEach = require('lodash/forEach');
const request = require('request-promise');
const _debug = require('debug')('facebook');
const {
  init,
  type,
  wait,
  clean,
  submit,
  captureResponse,
  captureScreenshot,
} = require('../../helpers/chrome');

const graphApi = request.defaults({
  baseUrl: 'https://graph.facebook.com/v2.9',
  headers: {
    Authorization: `OAuth ${process.env.FACEBOOK_APP_TOKEN}`,
  },
  json: true,
});

const cache = {};
const defaultAudience = '*.localhost';

function createTestUserAPI() {
  return graphApi({
    uri: `/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`,
    method: 'POST',
    body: {
      installed: false,
    },
  })
  .promise();
}

function createTestUser(localCache = cache) {
  return createTestUserAPI().tap((body) => {
    localCache.testUser = body;
  });
}

function deleteTestUserAPI(id) {
  return graphApi({
    uri: `/${id}`,
    method: 'DELETE',
  })
  .promise();
}

function deleteTestUser(localCache = cache) {
  const { testUser: { id } } = localCache;
  return deleteTestUserAPI(id);
}

function hostUrl(config) {
  const { http } = config;
  const { server } = http;
  return `http://localhost:${server.port}`;
}

function expect(code) {
  return response => assert.equal(response.status, code);
}

function extractToken() {
  const { Runtime } = this.protocol;

  return Runtime.evaluate({
    expression: 'window.$ms_users_inj_post_message',
    returnByValue: true,
    includeCommandLineAPI: true,
  })
  .then(({ result, exceptionDetails }) => {
    if (exceptionDetails) throw new Error(exceptionDetails.exception.description);
    _debug('extracted token:', result.value.payload.token);
    return result.value.payload.token;
  });
}

function getResponseBody(response) {
  const { Network } = this.protocol;
  const { requestId } = response;

  return Network.getResponseBody({ requestId }).then(it => it.body);
}

function createAccount(token) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'));
  const opts = {
    username: payload.email,
    password: 'mynicepassword',
    audience: defaultAudience,
    metadata: {
      service: 'craft',
    },
    sso: token,
  };

  return this.dispatch('users.register', opts)
    .reflect()
    .then(inspectPromise(true));
}

describe('#facebook', function oauthFacebookSuite() {
  beforeEach('init Chrome', init);
  beforeEach(global.startService);
  beforeEach(createTestUser);

  afterEach(deleteTestUser);
  afterEach(global.clearRedis);
  afterEach('clean Chrome', clean);

  function initiateAuth() {
    const { Page } = this.protocol;
    const serviceLink = hostUrl(this.users.config);
    const executeLink = `${serviceLink}/users/oauth/facebook`;

    Page.navigate({ url: executeLink });
    return Page.loadEventFired().then(() => (
      Promise
        .bind(this, 'input#email')
        .then(wait)
        .tap(captureScreenshot)
        .return(['input#email', cache.testUser.email])
        .spread(type)
        .return(['input#pass', cache.testUser.password])
        .spread(type)
        .then(captureScreenshot)
        .return('button[name=login]')
        .then(submit)
        .catch(captureScreenshot)
    ));
  }

  function authenticate() {
    return Promise.bind(this)
      .then(initiateAuth)
      .delay(1000)
      .tap(captureScreenshot)
      .return('button[name=__CONFIRM__]')
      .tap(wait)
      .catch(captureScreenshot)
      .then(submit);
  }

  function getFacebookToken() {
    return authenticate.call(this)
      .return('.no-js > body > script')
      .then(wait)
      .catch(captureScreenshot)
      .then(extractToken);
  }

  it('should able to retrieve faceboook profile', function test() {
    return getFacebookToken.call(this)
      .tap(_debug)
      .tap(assert);
  });

  it('should able to handle declined authentication', function test() {
    return Promise.bind(this)
      .then(initiateAuth)
      .return('button[name=__CANCEL__]')
      .tap(wait)
      .tap(captureScreenshot)
      .then(submit)
      .tap(() => _debug('submitted'))
      .return(/oauth\/facebook/)
      .then(captureResponse)
      .catch(captureScreenshot)
      .tap(expect(401));
  });

  it('should be able to register via facebook', function test() {
    return getFacebookToken.call(this)
      .then(createAccount)
      .then((registered) => {
        assert(registered.hasOwnProperty('jwt'));
        assert(registered.hasOwnProperty('user'));
        assert(registered.user.hasOwnProperty('metadata'));
        assert(registered.user.metadata.hasOwnProperty(defaultAudience));
        assert(registered.user.metadata[defaultAudience].hasOwnProperty('facebook'));
        assert.ifError(registered.user.password);
        assert.ifError(registered.user.audience);
      });
  });

  it('can get info about registered fb account through getInternalData & getMetadata', function test() {
    return getFacebookToken
      .call(this)
      .then(createAccount)
      .get('user')
      .then(user => Promise.all([
        this.users.amqp.publishAndWait('users.getInternalData', {
          username: user.metadata[defaultAudience].facebook.uid,
        }),
        this.users.amqp.publishAndWait('users.getMetadata', {
          username: user.metadata[defaultAudience].facebook.uid,
          audience: defaultAudience,
        }),
      ]))
      .reflect()
      .then(inspectPromise())
      .spread((internalData, metadata) => {
        // verify internal data
        assert.ok(internalData.facebook, 'facebook data not present');
        assert.ok(internalData.facebook.id, 'fb id is not present');
        assert.ok(internalData.facebook.email, 'fb email is not present');
        assert.ok(internalData.facebook.token, 'fb token is not present');
        assert.ifError(internalData.facebook.username, 'fb returned real username');
        assert.ifError(internalData.facebook.refreshToken, 'fb returned refresh token');

        // verify metadata
        assert.ok(metadata.facebook, 'facebook profile not present');
        console.log(metadata.facebook);
      });
  });

  it('should attach facebook profile to existing user', function test() {
    const { Page } = this.protocol;
    const serviceLink = hostUrl(this.users.config);
    const username = 'facebookuser@me.com';

    return Promise
      .bind(this)
      .tap(globalRegisterUser(username))
      .tap(globalAuthUser(username))
      .then(getFacebookToken)
      .then(assert.ifError)
      .catchReturn(TypeError)
      .catch(captureScreenshot)
      .tap(() => _debug('loggin in via facebook'))
      .then(() => {
        const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${this.jwt}`;

        Page.navigate({ url: executeLink });
        return Promise.bind(this, /oauth\/facebook/)
          .then(captureResponse)
          .tap(expect(200))
          .then(getResponseBody)
          .tap((body) => {
            const $ = cheerio.load(body);
            const vmScript = new vm.Script($('.no-js > body > script').html());
            const context = vm.createContext({ window: { close: () => {} } });
            vmScript.runInContext(context);

            assert.ok(context.$ms_users_inj_post_message);
            assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');

            assert(Object.keys(context.$ms_users_inj_post_message.payload).length);
          });
      });
  });

  it('should reject attaching already attached profile to a new user', function test() {
    const { Page } = this.protocol;
    const serviceLink = hostUrl(this.users.config);
    const username = 'facebookuser@me.com';

    return Promise
      .bind(this)
      .then(getFacebookToken)
      .then(createAccount)
      .tap(globalRegisterUser(username))
      .tap(globalAuthUser(username))
      .then(() => {
        const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${this.jwt}`;

        Page.navigate({ url: executeLink });
        return Promise.bind(this, /oauth\/facebook/)
          .then(captureResponse)
          .tap(expect(401))
          .then(getResponseBody)
          .tap((body) => {
            const $ = cheerio.load(body);
            const vmScript = new vm.Script($('.no-js > body > script').html());
            const context = vm.createContext({ window: { close: () => {} } });
            vmScript.runInContext(context);

            assert.ok(context.$ms_users_inj_post_message);

            assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');
            assert.equal(context.$ms_users_inj_post_message.error, true);
            assert.equal(context.$ms_users_inj_post_message.payload,
              'AuthenticationRequiredError: An attempt was made to perform an operation without authentication: HttpStatusError: profile is linked');
          });
      });
  });

  it('should be able to sign in with facebook account', function test() {
    const { Page } = this.protocol;
    const serviceLink = hostUrl(this.users.config);
    const username = 'facebookuser@me.com';

    return Promise
      .bind(this)
      .tap(globalRegisterUser(username))
      .tap(globalAuthUser(username))
      .then(getFacebookToken)
      .then(assert.ifError)
      .catchReturn(TypeError)
      .catch(captureScreenshot)
      .tap(() => _debug('loggin in via facebook'))
      .then(() => {
        const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${this.jwt}`;

        Page.navigate({ url: executeLink });
        return Promise
          .bind(this, /oauth\/facebook/)
          .then(captureResponse)
          .tap(expect(200));
      })
      .then(() => {
        const executeLink = `${serviceLink}/users/oauth/facebook`;

        Page.navigate({ url: executeLink });
        return Promise
          .bind(this, /oauth\/facebook/)
          .then(captureResponse)
          .tap(expect(200))
          .then(getResponseBody)
          .tap((body) => {
            const $ = cheerio.load(body);
            const vmScript = new vm.Script($('.no-js > body > script').html());
            const context = vm.createContext({ window: { close: () => {} } });
            vmScript.runInContext(context);

            assert.ok(context.$ms_users_inj_post_message);
            assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:logged-in');

            const payload = context.$ms_users_inj_post_message.payload;
            assert(payload.hasOwnProperty('jwt'));
            assert(payload.hasOwnProperty('user'));
            assert(payload.user.hasOwnProperty('metadata'));
            assert(payload.user.metadata.hasOwnProperty(defaultAudience));
            assert(payload.user.metadata[defaultAudience].hasOwnProperty('facebook'));
            assert.ifError(payload.user.password);
            assert.ifError(payload.user.audience);
          });
      });
  });

  it('should detach facebook profile', function test() {
    let uid = false;
    return getFacebookToken.call(this)
      .then(createAccount)
      .tap((registered) => {
        assert(registered.hasOwnProperty('jwt'));
        assert(registered.hasOwnProperty('user'));
        assert(registered.user.hasOwnProperty('metadata'));
        assert(registered.user.metadata.hasOwnProperty(defaultAudience));
        assert(registered.user.metadata[defaultAudience].hasOwnProperty('facebook'));
        assert.ifError(registered.user.password);
        assert.ifError(registered.user.audience);

        uid = `facebook:${registered.user.metadata[defaultAudience].facebook.id}`;
      })
      .tap((registered) => {
        const { username } = registered.user;
        return this.dispatch('users.oauth.detach', { username, provider: 'facebook' })
          .reflect()
          .then(inspectPromise(true))
          .tap((response) => {
            assert(response.success);
          });
      })
      .tap((registered) => {
        /** verify that related account has been pruned from metadata */
        const { username, metadata } = registered.user;
        return this.dispatch('users.getMetadata', { username, audience: Object.keys(metadata) })
          .reflect()
          .then(inspectPromise(true))
          .tap((response) => {
            forEach(response.metadata, (audience) => {
              assert.ifError(audience.facebook);
            });
          });
      })
      .tap((registered) => {
        /** verify that related account has been pruned from internal data */
        const { username } = registered.user;
        return this.dispatch('users.getInternalData', { username })
          .reflect()
          .then(inspectPromise(true))
          .tap((response) => {
            assert.ifError(response.facebook);
          });
      })
      .tap(() => {
        /** verify that related account has been dereferenced */
        return this.dispatch('users.getInternalData', { username: uid })
          .reflect()
          .then(inspectPromise(false))
          .then((error) => {
            assert.equal(error.statusCode, 404);
          });
      });
  });
});

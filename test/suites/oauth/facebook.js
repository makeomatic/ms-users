/* eslint-disable promise/always-return, no-prototype-builtins */
/* global globalRegisterUser, globalAuthUser */

const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const vm = require('vm');
const cheerio = require('cheerio');
const assert = require('assert');
const forEach = require('lodash/forEach');
const request = require('request-promise');
const config = require('../../config');
const _debug = require('debug')('facebook');
const {
  init,
  type,
  wait,
  clean,
  submit,
  captureResponseBody,
  captureScreenshot,
  exec,
} = require('@makeomatic/deploy/bin/chrome');

const graphApi = request.defaults({
  baseUrl: 'https://graph.facebook.com/v2.9',
  headers: {
    Authorization: `OAuth ${process.env.FACEBOOK_APP_TOKEN}`,
  },
  json: true,
});

const cache = {};
const defaultAudience = '*.localhost';

const createTestUserAPI = (props = {}) => graphApi({
  uri: `/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`,
  method: 'POST',
  body: {
    installed: false,
    ...props,
  },
}).promise();

const createTestUser = (localCache = cache) => Promise.props({
  testUser: createTestUserAPI(),
  testUserInstalled: createTestUserAPI({ installed: true }),
  testUserInstalledPartial: createTestUserAPI({ permissions: 'public_profile' }),
}).then((data) => {
  Object.assign(localCache, data);
});

function deleteTestUserAPI(id) {
  return graphApi({ uri: `/${id}`, method: 'DELETE' }).promise();
}

function deleteTestUser(localCache = cache) {
  return Promise.map(Object.keys(localCache), testUserType => (
    deleteTestUserAPI(localCache[testUserType].id)
  ));
}

function hostUrl(cfg) {
  const { http } = cfg;
  const { server } = http;
  return `http://localhost:${server.port}`;
}

function parseHTML(body) {
  const $ = cheerio.load(body);
  const vmScript = new vm.Script($('.no-js > body > script').html());
  const context = vm.createContext({ window: { close: () => {} } });
  vmScript.runInContext(context);
  return context;
}

function extractToken() {
  return Promise
    .bind(this, 'window.$ms_users_inj_post_message')
    .then(exec)
    .get('payload')
    .get('token');
}

function createAccount(token, overwrite = {}) {
  const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64'));
  const opts = {
    username: payload.email,
    password: 'mynicepassword',
    audience: defaultAudience,
    metadata: {
      service: 'craft',
    },
    sso: token,
    ...overwrite,
  };

  return this.dispatch('users.register', opts)
    .reflect()
    .then(inspectPromise(true));
}

function initiateAuth(_user) {
  const user = _user || cache.testUser;
  const { Page } = this.protocol;
  const serviceLink = hostUrl(this.users.config);
  const executeLink = `${serviceLink}/users/oauth/facebook`;

  Page.navigate({ url: executeLink });
  return Page.loadEventFired().then(() => (
    Promise
      .bind(this, 'input#email')
      .then(wait)
      .return(['input#email', user.email])
      .spread(type)
      .return(['input#pass', user.password])
      .spread(type)
      .return('button[name=login]')
      .then(submit)
      .catch(captureScreenshot)
  ));
}

function authenticate() {
  return Promise.bind(this)
    .then(initiateAuth)
    .delay(1000)
    .return('button[name=__CONFIRM__]')
    .tap(wait)
    .then(submit)
    .catch(captureScreenshot);
}

function getFacebookToken() {
  return authenticate.call(this)
    .return('.no-js > body > script')
    .then(wait)
    .then(extractToken)
    .catch(captureScreenshot);
}

describe('#facebook', function oauthFacebookSuite() {
  beforeEach('init Chrome', init);
  beforeEach(global.startService);
  beforeEach(createTestUser);

  afterEach(deleteTestUser);
  afterEach(global.clearRedis);
  afterEach('clean Chrome', clean);

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
      .then(submit)
      .tap(() => _debug('submitted'))
      .return([/oauth\/facebook/, 401])
      .spread(captureResponseBody)
      .catch(captureScreenshot);
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
        assert.ok(metadata[defaultAudience].facebook, 'facebook profile not present');
        assert.ok(metadata[defaultAudience].facebook.id, 'facebook scoped is not present');
        assert.ok(metadata[defaultAudience].facebook.displayName, 'fb display name not present');
        assert.ok(metadata[defaultAudience].facebook.gender, 'fb gender not present');
        assert.ok(metadata[defaultAudience].facebook.name, 'fb name not present');
        assert.ok(metadata[defaultAudience].facebook.uid, 'internal fb uid not present');
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
      // .then(assert.ifError)
      // .catchReturn(TypeError)
      .catch(captureScreenshot)
      .tap(() => _debug('loggin in via facebook'))
      .then(() => {
        const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${this.jwt}`;

        Page.navigate({ url: executeLink });
        return Promise.bind(this, [/oauth\/facebook/, 200])
          .spread(captureResponseBody)
          .tap((body) => {
            const context = parseHTML(body);

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
        return Promise
          .bind(this, [/oauth\/facebook/, 412])
          .spread(captureResponseBody)
          .tap((body) => {
            const context = parseHTML(body);

            assert.ok(context.$ms_users_inj_post_message);

            assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');
            assert.equal(context.$ms_users_inj_post_message.error, true);
            assert.deepEqual(context.$ms_users_inj_post_message.payload, {
              status: 412,
              statusCode: 412,
              status_code: 412,
              name: 'HttpStatusError',
              message: 'profile is linked',
            });
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
      .catch(captureScreenshot)
      .tap(() => _debug('loggin in via facebook'))
      .then(() => {
        const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${this.jwt}`;

        Page.navigate({ url: executeLink });
        return Promise
          .bind(this, [/oauth\/facebook/, 200])
          .spread(captureResponseBody);
      })
      .then(() => {
        const executeLink = `${serviceLink}/users/oauth/facebook`;

        Page.navigate({ url: executeLink });
        return Promise
          .bind(this, [/oauth\/facebook/, 200])
          .spread(captureResponseBody)
          .tap((body) => {
            const context = parseHTML(body);

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
        const { username } = registered.user.metadata['*.localhost'];
        return this.dispatch('users.oauth.detach', { username, provider: 'facebook' })
          .reflect()
          .then(inspectPromise(true))
          .tap((response) => {
            assert(response.success);
          });
      })
      .tap((registered) => {
        /* verify that related account has been pruned from metadata */
        const { username } = registered.user.metadata['*.localhost'];
        const { metadata } = registered.user;
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
        /* verify that related account has been pruned from internal data */
        const { username } = registered.user.metadata['*.localhost'];

        return this.dispatch('users.getInternalData', { username })
          .reflect()
          .then(inspectPromise(true))
          .tap((response) => {
            assert.ifError(response.facebook);
          });
      })
      .tap(() => {
        /* verify that related account has been dereferenced */
        return this.dispatch('users.getInternalData', { username: uid })
          .reflect()
          .then(inspectPromise(false))
          .then((error) => {
            assert.equal(error.statusCode, 404);
          });
      });
  });

  it('should reject when signing in with partially returned scope and report it', function test() {
    return Promise
      .bind(this, cache.testUserInstalledPartial)
      .then(initiateAuth)
      .return('#platformDialogForm a[id]')
      .then(submit)
      .return('#platformDialogForm label:nth-child(2) input[type=checkbox]')
      .then(submit)
      .return('button[name=__CONFIRM__]')
      .then(submit)
      .return([/oauth\/facebook/, 401])
      .spread(captureResponseBody)
      .tap((body) => {
        const context = parseHTML(body);

        assert.ok(context.$ms_users_inj_post_message);
        assert.deepEqual(context.$ms_users_inj_post_message.payload, {
          args: { 0: 'missing permissions - email' },
          message: 'An attempt was made to perform an operation without authentication: missing permissions - email',
          name: 'AuthenticationRequiredError',
          missingPermissions: ['email'],
        });
      });
  });

  it('apply config: retryOnMissingPermissions=true', function test() {
    config.oauth.providers.facebook.retryOnMissingPermissions = true;
  });

  it('should re-request partially returned scope endlessly', function test() {
    return Promise
      .bind(this, cache.testUserInstalledPartial)
      .then(initiateAuth)
      .return('#platformDialogForm a[id]')
      .then(submit)
      .return('#platformDialogForm label:nth-child(2) input[type=checkbox]')
      .then(submit)
      .return('button[name=__CONFIRM__]')
      .then(submit)
      .return([/dialog\/oauth\?auth_type=rerequest/, 200])
      .spread(captureResponseBody);
  });

  it('apply config: retryOnMissingPermissions=false', function test() {
    config.oauth.providers.facebook.retryOnMissingPermissions = false;
  });

  it('should login with partially returned scope and report it', function test() {
    return Promise
      .bind(this, cache.testUserInstalledPartial)
      .then(initiateAuth)
      .return('#platformDialogForm a[id]')
      .then(submit)
      .return('#platformDialogForm label:nth-child(2) input[type=checkbox]')
      .then(submit)
      .return('button[name=__CONFIRM__]')
      .then(submit)
      .return([/oauth\/facebook/, 200])
      .spread(captureResponseBody)
      .tap((body) => {
        const context = parseHTML(body);

        assert.ok(context.$ms_users_inj_post_message);
        assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');
        assert.equal(context.$ms_users_inj_post_message.error, false);
        assert.deepEqual(context.$ms_users_inj_post_message.missingPermissions, ['email']);
        assert.ok(context.$ms_users_inj_post_message.payload.token, 'missing token');
        assert.equal(context.$ms_users_inj_post_message.payload.provider, 'facebook');
      });
  });

  it('should register with partially returned scope and require email verification', function test() {
    return Promise
      .bind(this, cache.testUserInstalledPartial)
      .then(initiateAuth)
      .return('#platformDialogForm a[id]')
      .then(submit)
      .return('#platformDialogForm label:nth-child(2) input[type=checkbox]')
      .then(submit)
      .return('button[name=__CONFIRM__]')
      .then(submit)
      .return([/oauth\/facebook/, 200])
      .spread(captureResponseBody)
      .then((body) => {
        const context = parseHTML(body);

        assert.ok(context.$ms_users_inj_post_message);
        assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');
        assert.equal(context.$ms_users_inj_post_message.error, false);
        assert.deepEqual(context.$ms_users_inj_post_message.missingPermissions, ['email']);
        assert.ok(context.$ms_users_inj_post_message.payload.token, 'missing token');
        assert.equal(context.$ms_users_inj_post_message.payload.provider, 'facebook');

        return [context.$ms_users_inj_post_message.payload.token, { username: 'unverified@makeomatic.ca' }];
      })
      .spread(createAccount)
      .then(({ requiresActivation, id }) => {
        assert.equal(requiresActivation, true);
        assert.ok(id);
      });
  });
});

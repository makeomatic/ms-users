/* eslint-disable no-prototype-builtins */
/* global globalRegisterUser, globalAuthUser */

const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const vm = require('vm');
const cheerio = require('cheerio');
const assert = require('assert');
const forEach = require('lodash/forEach');
const request = require('request-promise');
const config = require('../../config');
const puppeteer = require('puppeteer');

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
  return `http://ms-users.local:${server.port}`;
}

function parseHTML(body) {
  const $ = cheerio.load(body);
  const vmScript = new vm.Script($('.no-js > body > script').html());
  const context = vm.createContext({ window: { close: () => {} } });
  vmScript.runInContext(context);
  return context;
}

describe('#facebook', function oauthFacebookSuite() {
  let chrome;
  let page;
  let service;

  // retries tests several times in case of failure
  this.retries(3);

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

    return service.dispatch('register', { params: opts })
      .reflect()
      .then(inspectPromise(true));
  }

  async function initiateAuth(_user) {
    const user = _user || cache.testUser;
    const serviceLink = hostUrl(service.config);
    const executeLink = `${serviceLink}/users/oauth/facebook`;

    try {
      await page.goto(executeLink, { waitUntil: 'networkidle2' });
      await page.waitForSelector('input#email');
      await page.type('input#email', user.email, { delay: 100 });
      await page.waitForSelector('input#pass');
      await page.type('input#pass', user.password, { delay: 100 });
      const formSubmit = await page.$('button[name=login]');
      await formSubmit.click();
      await formSubmit.dispose();
    } catch (e) {
      console.error('failed to initiate auth', e);
      await page.screenshot({ fullPage: true, path: `./ss/initiate-auth-${Date.now()}.png` });
      throw e;
    }
  }

  async function authenticate() {
    await initiateAuth();
    await Promise.delay(1000);

    try {
      await page.waitForSelector('button[name=__CONFIRM__]');
      const formSubmit = await page.$('button[name=__CONFIRM__]');
      await formSubmit.click();
      await formSubmit.dispose();
    } catch (e) {
      await page.screenshot({ fullPage: true, path: `./ss/authenticate-${Date.now()}.png` });
      throw e;
    }
  }

  async function extractBody() {
    return page.evaluate('window.$ms_users_inj_post_message');
  }

  async function extractToken() {
    const { payload: { token } } = await extractBody();
    return token;
  }

  async function getFacebookToken() {
    await authenticate();
    await page.waitForSelector('.no-js > body > script');

    let token;
    try {
      token = await extractToken();
    } catch (e) {
      await page.screenshot({ fullPage: true, path: `./ss/token-${Date.now()}.png` });
      throw e;
    }

    return token;
  }

  async function signInAndNavigate() {
    await initiateAuth(cache.testUserInstalledPartial);
    await Promise.delay(1000);

    try {
      await page.waitForSelector('#platformDialogForm a[id]');
      await page.click('#platformDialogForm a[id]');
      console.info('#platformDialogForm a[id]');
      await page.waitForSelector('#platformDialogForm label:nth-child(2) input[type=checkbox]');
      await page.click('#platformDialogForm label:nth-child(2) input[type=checkbox]');
      console.info('#platformDialogForm label:nth-child(2) input[type=checkbox]');
      await page.waitForSelector('button[name=__CONFIRM__]');
      await page.click('button[name=__CONFIRM__]');
      console.info('button[name=__CONFIRM__]');
      const response = await page.waitForNavigation({ waitUntil: 'networkidle2' });
      console.info('response');
      const status = response.status();
      const url = response.url();

      return { response, status, url };
    } catch (e) {
      await page.screenshot({ fullPage: true, path: `./ss/sandnav-${Date.now()}.png` });
      throw e;
    }
  }

  // need to relaunch each time for clean contexts
  beforeEach('init Chrome', async () => {
    chrome = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--headless', '--disable-gpu'],
    });
    page = await chrome.newPage();
  });

  afterEach('close chrome', async () => {
    if (page) await page.close();
    if (chrome) await chrome.close();
  });

  beforeEach('start', global.startService);
  beforeEach('create user', createTestUser);
  beforeEach('save ref', function saveServiceRef() {
    service = this.users;
  });

  afterEach(deleteTestUser);
  afterEach(global.clearRedis);

  it('should able to retrieve faceboook profile', async () => {
    const token = await getFacebookToken();
    console.assert(token, 'did not get token -', token);
  });

  it('should able to handle declined authentication', async () => {
    await initiateAuth();

    await page.waitForSelector('button[name=__CANCEL__]');
    const formSubmit = await page.$('button[name=__CANCEL__]');
    await formSubmit.click();
    await formSubmit.dispose();

    const response = await page.waitForNavigation({ waitUntil: 'networkidle2' });
    const status = response.status();
    const url = response.url();

    console.assert(status === 401, 'statusCode is %s, url is %s', status, url);
  });

  it('should be able to register via facebook', async () => {
    const token = await getFacebookToken();
    const registered = await createAccount(token);

    assert(registered.hasOwnProperty('jwt'));
    assert(registered.hasOwnProperty('user'));
    assert(registered.user.hasOwnProperty('metadata'));
    assert(registered.user.metadata.hasOwnProperty(defaultAudience));
    assert(registered.user.metadata[defaultAudience].hasOwnProperty('facebook'));
    assert.ifError(registered.user.password);
    assert.ifError(registered.user.audience);
  });

  it('can get info about registered fb account through getInternalData & getMetadata', async () => {
    const token = await getFacebookToken();
    const { user } = await createAccount(token);
    const [internalData, metadata] = await Promise
      .all([
        service.amqp.publishAndWait('users.getInternalData', {
          username: user.metadata[defaultAudience].facebook.uid,
        }),
        service.amqp.publishAndWait('users.getMetadata', {
          username: user.metadata[defaultAudience].facebook.uid,
          audience: defaultAudience,
        }),
      ])
      .reflect()
      .then(inspectPromise());

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

  it('should attach facebook profile to existing user', async () => {
    const serviceLink = hostUrl(service.config);
    const username = 'facebookuser@me.com';
    const databag = { service };

    await globalRegisterUser(username).call(databag);
    await globalAuthUser(username).call(databag);

    // pre-auth user
    await getFacebookToken();
    await Promise.delay(1000);

    const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${databag.jwt}`;
    console.info('opening %s', executeLink);

    const response = await page.goto(executeLink, { waitUntil: 'networkidle2' });
    const status = response.status();
    const url = response.url();

    console.assert(status === 200, 'Page is %s and status is %s', url, status);

    const body = await page.content();
    const context = parseHTML(body);

    console.assert(context.$ms_users_inj_post_message, 'post message not present:', body);
    console.assert(context.$ms_users_inj_post_message.type === 'ms-users:attached', 'type wrong', body);
    console.assert(Object.keys(context.$ms_users_inj_post_message.payload).length);
  });

  it('should reject attaching already attached profile to a new user', async () => {
    const serviceLink = hostUrl(service.config);
    const username = 'facebookuser@me.com';
    const databag = { service };

    await createAccount(await getFacebookToken());
    await globalRegisterUser(username).call(databag);
    await globalAuthUser(username).call(databag);

    const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${databag.jwt}`;
    console.info('opening %s', executeLink);
    const response = await page.goto(executeLink, { waitUntil: 'networkidle2' });
    const status = response.status();
    const url = response.url();

    console.assert(status === 412, 'Page is %s and status is %s', url, status);

    const body = await page.content();
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

  it('should be able to sign in with facebook account', async function test() {
    const serviceLink = hostUrl(service.config);
    const username = 'facebookuser@me.com';
    const databag = { service };

    await globalRegisterUser(username).call(databag);
    await globalAuthUser(username).call(databag);
    await getFacebookToken();
    await Promise.delay(1000);

    let response;
    let status;
    let url;

    const executeLink = `${serviceLink}/users/oauth/facebook`;

    /* initial request for attaching account */
    response = await page.goto(`${executeLink}?jwt=${databag.jwt}`, { waitUntil: 'networkidle2' });
    status = response.status();
    url = response.url();

    console.assert(status === 200, 'attaching account failed - %s - %s', status, url);

    response = await page.goto(executeLink, { waitUntil: 'networkidle2' });
    status = response.status();
    url = response.url();

    console.assert(status === 200, 'signing in failed - %s - %s', status, url);

    const body = await page.content();
    const context = parseHTML(body);

    assert.ok(context.$ms_users_inj_post_message);
    assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:logged-in');

    const { payload } = context.$ms_users_inj_post_message;
    assert(payload.hasOwnProperty('jwt'));
    assert(payload.hasOwnProperty('user'));
    assert(payload.user.hasOwnProperty('metadata'));
    assert(payload.user.metadata.hasOwnProperty(defaultAudience));
    assert(payload.user.metadata[defaultAudience].hasOwnProperty('facebook'));
    assert.ifError(payload.user.password);
    assert.ifError(payload.user.audience);
  });

  it('should detach facebook profile', async () => {
    const registered = await createAccount(await getFacebookToken());

    assert(registered.hasOwnProperty('jwt'));
    assert(registered.hasOwnProperty('user'));
    assert(registered.user.hasOwnProperty('metadata'));
    assert(registered.user.metadata.hasOwnProperty(defaultAudience));
    assert(registered.user.metadata[defaultAudience].hasOwnProperty('facebook'));
    assert.ifError(registered.user.password);
    assert.ifError(registered.user.audience);

    const uid = `facebook:${registered.user.metadata[defaultAudience].facebook.id}`;
    const { username } = registered.user.metadata['*.localhost'];
    let response;

    response = await service
      .dispatch('oauth.detach', { params: { username, provider: 'facebook' } })
      .reflect()
      .then(inspectPromise(true));

    assert(response.success, 'werent able to detach');

    /* verify that related account has been pruned from metadata */
    response = await service
      .dispatch('getMetadata', {
        params: { username, audience: Object.keys(registered.user.metadata) },
      })
      .reflect()
      .then(inspectPromise(true));

    forEach(response.metadata, (audience) => {
      assert.ifError(audience.facebook);
    });

    /* verify that related account has been pruned from internal data */
    response = await service
      .dispatch('getInternalData', { params: { username } })
      .reflect()
      .then(inspectPromise(true));

    assert.ifError(response.facebook, 'did not detach fb');

    /* verify that related account has been dereferenced */
    const error = await service
      .dispatch('getInternalData', { params: { username: uid } })
      .reflect()
      .then(inspectPromise(false));

    assert.equal(error.statusCode, 404);
  });

  it('should reject when signing in with partially returned scope and report it', async () => {
    const { status, url } = await signInAndNavigate();

    const body = await page.content();
    const context = parseHTML(body);

    console.assert(status === 401, 'did not reject partial sign in - %s - %s', status, url);

    assert.ok(context.$ms_users_inj_post_message);
    assert.deepEqual(context.$ms_users_inj_post_message.payload, {
      args: { 0: 'missing permissions - email' },
      message: 'An attempt was made to perform an operation without authentication: missing permissions - email',
      name: 'AuthenticationRequiredError',
      missingPermissions: ['email'],
    });
  });

  it('apply config: retryOnMissingPermissions=true', () => {
    config.oauth.providers.facebook.retryOnMissingPermissions = true;
  });

  it('should re-request partially returned scope endlessly', async () => {
    const { status, url } = await signInAndNavigate();

    console.assert(status === 200, 'failed to redirect back - %s - %s', status, url);
    console.assert(/dialog\/oauth\?auth_type=rerequest/.test(url), 'failed to redirect back - %s - %s', status, url);
  });

  it('apply config: retryOnMissingPermissions=false', function test() {
    config.oauth.providers.facebook.retryOnMissingPermissions = false;
  });

  it('should login with partially returned scope and report it', async () => {
    const { status, url } = await signInAndNavigate();

    console.assert(status === 200, 'failed to redirect back - %s - %s', status, url);

    const body = await page.content();
    const context = parseHTML(body);

    assert.ok(context.$ms_users_inj_post_message);
    assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');
    assert.equal(context.$ms_users_inj_post_message.error, false);
    assert.deepEqual(context.$ms_users_inj_post_message.missingPermissions, ['email']);
    assert.ok(context.$ms_users_inj_post_message.payload.token, 'missing token');
    assert.equal(context.$ms_users_inj_post_message.payload.provider, 'facebook');
  });

  it('should register with partially returned scope and require email verification', async () => {
    const { status, url } = await signInAndNavigate();

    console.assert(status === 200, 'failed to redirect back - %s - %s', status, url);

    const body = await page.content();
    const context = parseHTML(body);

    assert.ok(context.$ms_users_inj_post_message);
    assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');
    assert.equal(context.$ms_users_inj_post_message.error, false);
    assert.deepEqual(context.$ms_users_inj_post_message.missingPermissions, ['email']);
    assert.ok(context.$ms_users_inj_post_message.payload.token, 'missing token');
    assert.equal(context.$ms_users_inj_post_message.payload.provider, 'facebook');

    const { requiresActivation, id } = await createAccount(
      context.$ms_users_inj_post_message.payload.token,
      { username: 'unverified@makeomatic.ca' }
    );

    assert.equal(requiresActivation, true);
    assert.ok(id);
  });
});

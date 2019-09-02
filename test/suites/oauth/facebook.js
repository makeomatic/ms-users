/* eslint-disable no-prototype-builtins */
/* global globalRegisterUser, globalAuthUser */

const authenticator = require('otplib/authenticator');
const { inspectPromise } = require('@makeomatic/deploy');
const Promise = require('bluebird');
const vm = require('vm');
const cheerio = require('cheerio');
const assert = require('assert');
const forEach = require('lodash/forEach');
const request = require('request-promise');
const puppeteer = require('puppeteer');

const serviceLink = 'https://ms-users.local';

const graphApi = request.defaults({
  baseUrl: 'https://graph.facebook.com/v3.3',
  headers: {
    Authorization: `OAuth ${process.env.FACEBOOK_APP_TOKEN}`,
  },
  json: true,
});

const defaultAudience = '*.localhost';

const createTestUserAPI = (props = {}) => graphApi({
  uri: `/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`,
  method: 'POST',
  body: {
    installed: false,
    ...props,
  },
}).promise();

const createTestUser = () => createTestUserAPI();
const createTestUserInstalledPartial = () => createTestUserAPI({ permissions: 'public_profile' });

const deleteTestUser = uid => graphApi({
  uri: `${uid}`,
  method: 'DELETE',
}).promise();

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
  let lastRequestResponse;
  let service;
  let facebookUser;
  let facebookUserInstalledPartial;

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

  async function deAuthApplication() {
    await graphApi({
      uri: `/${facebookUser.id}/permissions`,
      method: 'DELETE',
    });
    await graphApi({
      uri: `/${facebookUserInstalledPartial.id}/permissions`,
      method: 'DELETE',
    });
  }

  const initiateAuth = async (user) => {
    const executeLink = `${serviceLink}/users/oauth/facebook`;
    try {
      await page.goto(executeLink, { waitUntil: 'networkidle2' });
      await page.screenshot({ fullPage: true, path: './ss/1.png' });
      await page.waitForSelector('input#email');
      await page.type('input#email', user.email, { delay: 100 });
      await page.screenshot({ fullPage: true, path: './ss/2.png' });
      await page.waitForSelector('input#pass');
      await page.type('input#pass', user.password, { delay: 100 });
      await page.screenshot({ fullPage: true, path: './ss/3.png' });
      await page.click('button[name=login]', { delay: 100 });
    } catch (e) {
      console.error('failed to initiate auth', e);
      await page.screenshot({ fullPage: true, path: `./ss/initiate-auth-${Date.now()}.png` });
      throw e;
    }
  };

  async function authenticate(user) {
    await initiateAuth(user);
    try {
      await page.waitForSelector('button[name=__CONFIRM__]');
      await page.click('button[name=__CONFIRM__]', { delay: 100 });
    } catch (e) {
      await page.screenshot({ fullPage: true, path: `./ss/authenticate-${Date.now()}.png` });
      throw e;
    }
  }

  async function extractBody() {
    return page.evaluate('window.$ms_users_inj_post_message');
  }

  async function navigate({ href, waitUntil = 'networkidle0' } = {}) {
    if (href) {
      await page.goto(href, { waitUntil, timeout: 30000 });
    } else {
      await page.waitForNavigation({ waitUntil, timeout: 30000 });
    }

    // just to be sure
    await Promise.delay(1000);
    // maybe this is the actual request status code
    const status = lastRequestResponse.status();
    const url = page.url();
    let body;
    try {
      body = await page.content();
    } catch (e) {
      body = e.message;
    }

    console.info('%s - %s', status, url);

    return { body, status, url };
  }

  async function getFacebookToken(user) {
    await authenticate(user);
    await Promise.all([
      navigate(), // so that refresh works, etc
      page.waitForSelector('.no-js > body > script'),
    ]);

    try {
      const body = await extractBody();

      assert(body.payload.token, JSON.stringify(body));

      return {
        body,
        token: body.payload.token,
      };
    } catch (e) {
      await page.screenshot({ fullPage: true, path: `./ss/token-${Date.now()}.png` });
      throw e;
    }
  }

  async function signInAndNavigate(user, predicate) {
    await initiateAuth(user);

    let response;
    try {
      await page.waitForSelector('#platformDialogForm a[id]', { visible: true });
      await page.click('#platformDialogForm a[id]', { delay: 100 });
      await Promise.delay(300);
      await page.waitForSelector('#platformDialogForm label:nth-child(2)', { visible: true });
      await page.click('#platformDialogForm label:nth-child(2)', { delay: 100 });
      await Promise.delay(300);
      await page.waitForSelector('button[name=__CONFIRM__]', { visible: true });
      await page.click('button[name=__CONFIRM__]', { delay: 100 });
      response = await page.waitForResponse(predicate);
    } catch (e) {
      console.error('failed to navigate', e);
      await page.screenshot({ fullPage: true, path: `./ss/sandnav-${Date.now()}.png` });
      throw e;
    }

    return response;
  }

  beforeEach('start', async () => {
    service = await global.startService(this.testConfig);
  });

  beforeEach('start chrome', async () => {
    chrome = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox'],
    });
    page = await chrome.newPage();

    // rewrite window.close()
    await page.exposeFunction('close', () => (
      console.info('triggered window.close()')
    ));

    page.on('requestfinished', (req) => {
      lastRequestResponse = req.response();
    });
  });

  afterEach('DeAuthenticate application', deAuthApplication);

  afterEach('stop chrome', async () => {
    if (page) await page.close();
    if (chrome) await chrome.close();
    await global.clearRedis();
  });

  before('create test users', async () => {
    facebookUser = await createTestUser();
    facebookUserInstalledPartial = await createTestUserInstalledPartial();
  });

  after('delete test users', async () => {
    await deleteTestUser(facebookUser.id);
    await deleteTestUser(facebookUserInstalledPartial.id);
  });

  it('should able to retrieve faceboook profile', async () => {
    const { token, body } = await getFacebookToken(facebookUser);
    assert(token, `did not get token - ${token} - ${body}`);
  });

  it('should able to handle declined authentication', async () => {
    await initiateAuth(facebookUser);

    try {
      await page.waitForSelector('button[name=__CANCEL__]');
      await page.click('button[name=__CANCEL__]');

      const { status, url } = await navigate();
      assert(status === 401, `statusCode is ${status}, url is ${url}`);
    } catch (e) {
      await page.screenshot({ fullPage: true, path: `./ss/declined-${Date.now()}.png` });
      throw e;
    }
  });

  it('should be able to register via facebook', async () => {
    const { token } = await getFacebookToken(facebookUser);
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
    const { token } = await getFacebookToken(facebookUser);
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
    assert.ok(metadata[defaultAudience].facebook.name, 'fb name not present');
    assert.ok(metadata[defaultAudience].facebook.uid, 'internal fb uid not present');
  });

  it('should attach facebook profile to existing user', async () => {
    const username = 'facebookuser@me.com';
    const databag = { service };

    await globalRegisterUser(username).call(databag);
    await globalAuthUser(username).call(databag);
    // pre-auth user
    await getFacebookToken(facebookUser);
    await Promise.delay(1000);

    const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${databag.jwt}`;
    console.info('opening %s', executeLink);

    const { status, url, body } = await navigate({ href: executeLink });

    assert(status === 200, `Page is ${url} and status is ${status}`);

    const context = parseHTML(body);

    assert(context.$ms_users_inj_post_message, `post message not present: ${body}`);
    assert(context.$ms_users_inj_post_message.type === 'ms-users:attached', `type wrong -> ${body}`);
    assert(Object.keys(context.$ms_users_inj_post_message.payload).length);
  });

  it('should reject attaching already attached profile to a new user', async () => {
    const username = 'facebookuser@me.com';
    const databag = { service };

    const { token } = await getFacebookToken(facebookUser);
    await createAccount(token);
    await globalRegisterUser(username).call(databag);
    await globalAuthUser(username).call(databag);
    await Promise.delay(1000);

    const executeLink = `${serviceLink}/users/oauth/facebook?jwt=${databag.jwt}`;
    console.info('opening %s', executeLink);
    const { status, url, body } = await navigate({ href: executeLink });

    assert(status === 412, `Page is ${url} and status is ${status}`);

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
    const username = 'facebookuser@me.com';
    const databag = { service };

    await globalRegisterUser(username).call(databag);
    await globalAuthUser(username).call(databag);
    await getFacebookToken(facebookUser);
    await Promise.delay(1000);

    const executeLink = `${serviceLink}/users/oauth/facebook`;

    /* initial request for attaching account */
    const preRequest = await navigate({ href: `${executeLink}?jwt=${databag.jwt}` });
    assert(preRequest.status === 200, `attaching account failed - ${preRequest.status} - ${preRequest.url}`);

    const { status, url, body } = await navigate({ href: executeLink });
    assert(status === 200, `signing in failed - ${status} - ${url}`);

    const context = parseHTML(body);

    assert.ok(context.$ms_users_inj_post_message);
    assert.equal(context.$ms_users_inj_post_message.error, false);
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
    const { token } = await getFacebookToken(facebookUser);
    const registered = await createAccount(token);

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
    const data = await signInAndNavigate(facebookUserInstalledPartial, (response) => {
      return response.url().startsWith(serviceLink) && response.status() === 401;
    });

    const status = data.status();
    const url = data.url();
    const body = await data.text();

    assert(status === 401, `did not reject partial sign in - ${status} - ${url} - ${body}`);

    const context = parseHTML(body);
    assert.ok(context.$ms_users_inj_post_message);
    assert.deepEqual(context.$ms_users_inj_post_message.payload, {
      args: { 0: 'missing permissions - email' },
      message: 'An attempt was made to perform an operation without authentication: missing permissions - email',
      name: 'AuthenticationRequiredError',
      missingPermissions: ['email'],
    });
  });

  describe('should re-request partially returned scope endlessly', () => {
    before('apply', () => {
      this.testConfig = {
        oauth: { providers: { facebook: { retryOnMissingPermissions: true } } },
      };
    });

    it('should re-request partially returned scope endlessly', async () => {
      const pageResponse = await signInAndNavigate(facebookUserInstalledPartial, (response) => {
        return /dialog\/oauth\?auth_type=rerequest/.test(response.url());
      });

      const url = pageResponse.url();
      const status = pageResponse.status();

      assert(/dialog\/oauth\?auth_type=rerequest/.test(url), `failed to redirect back - ${status} - ${url}`);
    });

    after('remove', () => {
      delete this.testConfig;
    });
  });

  describe('should login with partially returned scope and report it', () => {
    before('apply', () => {
      this.testConfig = {
        oauth: { providers: { facebook: { retryOnMissingPermissions: false } } },
      };
    });

    it('should login with partially returned scope and report it', async () => {
      const data = await signInAndNavigate(facebookUserInstalledPartial, (response) => {
        return response.url().startsWith(serviceLink) && response.status() === 200;
      });

      const body = await data.text();
      const context = parseHTML(body);

      assert.ok(context.$ms_users_inj_post_message);
      assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:attached');
      assert.equal(context.$ms_users_inj_post_message.error, false);
      assert.deepEqual(context.$ms_users_inj_post_message.missingPermissions, ['email']);
      assert.ok(context.$ms_users_inj_post_message.payload.token, 'missing token');
      assert.equal(context.$ms_users_inj_post_message.payload.provider, 'facebook');
    });

    it('should register with partially returned scope and require email verification', async () => {
      const data = await signInAndNavigate(facebookUserInstalledPartial, (response) => {
        return response.url().startsWith(serviceLink) && response.status() === 200;
      });

      const status = data.status();
      const url = data.url();
      const body = await data.text();

      assert(status === 200, `failed to redirect back - ${status} - ${url} - ${body}`);

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

    after('remove', () => {
      delete this.testConfig;
    });
  });

  it('should be able to sign in with facebook account if mfa is enabled', async function test() {
    const username = 'facebookuser@me.com';
    const databag = { service };

    await globalRegisterUser(username).call(databag);
    await globalAuthUser(username).call(databag);
    await getFacebookToken(facebookUser);
    await Promise.delay(1000);

    // enable mfa
    const { secret } = await service.dispatch('mfa.generate-key', { params: { username, time: Date.now() } });
    await service.dispatch('mfa.attach', { params: { username, secret, totp: authenticator.generate(secret) } });

    const executeLink = `${serviceLink}/users/oauth/facebook`;

    /* initial request for attaching account */
    const preRequest = await navigate({ href: `${executeLink}?jwt=${databag.jwt}` });
    assert(preRequest.status === 200, `attaching account failed - ${preRequest.status} - ${preRequest.url}`);

    const { status, url, body } = await navigate({ href: executeLink });
    assert(status === 403, `mfa was not requested - ${status} - ${url}`);

    const context = parseHTML(body);

    assert.ok(context.$ms_users_inj_post_message);
    assert.equal(context.$ms_users_inj_post_message.error, true);
    assert.equal(context.$ms_users_inj_post_message.type, 'ms-users:totp_required');

    const { payload: { userId, token } } = context.$ms_users_inj_post_message;
    const login = await service.dispatch(
      'login',
      {
        params: { username: userId, password: token, isOAuthFollowUp: true, audience: defaultAudience },
        headers: { 'x-auth-totp': authenticator.generate(secret) },
      }
    );

    assert(login.hasOwnProperty('jwt'));
    assert(login.hasOwnProperty('user'));
    assert(login.hasOwnProperty('mfa'));
    assert(login.user.hasOwnProperty('metadata'));
    assert(login.user.metadata.hasOwnProperty(defaultAudience));
    assert(login.user.metadata[defaultAudience].hasOwnProperty('facebook'));
    assert.ifError(login.user.password);
    assert.ifError(login.user.audience);
  });
});

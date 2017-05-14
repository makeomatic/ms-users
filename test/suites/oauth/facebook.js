/* global inspectPromise, globalRegisterUser */

const Promise = require('bluebird');
const assert = require('assert');
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

function createTestUser() {
  return graphApi({
    uri: `/${process.env.FACEBOOK_CLIENT_ID}/accounts/test-users`,
    method: 'POST',
    body: {
      installed: false,
    },
  })
  .then((body) => {
    cache.testUser = body;
    return body;
  });
}

function deleteTestUser() {
  const { testUser: { id } } = cache;

  return graphApi({
    uri: `/${id}`,
    method: 'DELETE',
  });
}

function hostUrl(config) {
  const { http } = config;
  const { server } = http;
  return `http://localhost:${server.port}`;
}

describe('#facebook', function oauthFacebookSuite() {
  before('init Chrome', init);
  beforeEach(global.startService);
  beforeEach(createTestUser);

  afterEach(deleteTestUser);
  afterEach(global.clearRedis);
  after('clean Chrome', clean);

  it('should able to authenticate', function test() {
    const { Page } = this.protocol;
    const serviceLink = hostUrl(this.users.config);
    const executeLink = `${serviceLink}/users/oauth/facebook`;

    Page.navigate({ url: executeLink });

    return Page.loadEventFired().then(() => (
      Promise
        .bind(this, 'input#email')
        .tap(field => _debug('waiting for form', field))
        .then(wait)
        .tap(() => _debug('capturing screenshot'))
        .tap(captureScreenshot)
        .tap(() => _debug('filling form'))
        .return(['input#email', cache.testUser.email])
        .spread(type)
        .return(['input#pass', cache.testUser.password])
        .spread(type)
        .then(captureScreenshot)
        .return('button[name=login]')
        .then(submit)
        .return('button[name=__CONFIRM__]')
        .tap(wait)
        .tap(captureScreenshot)
        .then(submit)
        .return('.no-js > body > script')
        .then(wait)
        .tap(captureScreenshot)
    ));
  });

  it('should able to handle declined authentication', function test() {
    const { Page } = this.protocol;
    const serviceLink = hostUrl(this.users.config);
    const executeLink = `${serviceLink}/users/oauth/facebook`;

    Page.navigate({ url: executeLink });

    return Page.loadEventFired().then(() => (
      Promise
        .bind(this, 'input#email')
        .tap(field => _debug('waiting for form', field))
        .then(wait)
        .tap(() => _debug('capturing screenshot'))
        .tap(captureScreenshot)
        .tap(() => _debug('filling form'))
        .return(['input#email', cache.testUser.email])
        .spread(type)
        .return(['input#pass', cache.testUser.password])
        .spread(type)
        .then(captureScreenshot)
        .return('button[name=login]')
        .then(submit)
        .return('button[name=__CANCEL__]')
        .tap(wait)
        .tap(captureScreenshot)
        .tap(submit)
        .return(/oauth\/facebook/)
        .then(captureResponse)
        .tap(captureScreenshot)
        .tap((response) => {
          assert.equal(response.status, 401);
        })
    ));
  });
});

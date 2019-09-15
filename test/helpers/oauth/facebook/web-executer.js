const vm = require('vm');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const Promise = require('bluebird');
const assert = require('assert');

const util = require('util');

const errors = require('common-errors');

const WebExecuterTimeoutError = errors.helpers.generateClass('WebExecuterTimeoutError', {
  args: ['status_code', 'message', 'url', 'page_contents', 'inner_error'],
});

/**
 * Wrap for all `puppeter` actions needed to test Facebook Login process
 */
class WebExecuter {
  static get serviceLink() { return this._serviceLink; }

  static set serviceLink(v) { this._serviceLink = v; }

  constructor() {
    this._serviceLink = WebExecuter.serviceLink;
  }

  async stop() {
    const { page, chrome } = this;
    if (page) {
      await page.close();
    }
    if (chrome) {
      await chrome.close();
    }
  }

  async start() {
    this.chrome = await puppeteer.launch({
      executablePath: '/usr/bin/chromium-browser',
      ignoreHTTPSErrors: true,
      args: ['--no-sandbox'],
    });

    const page = this.page = await this.chrome.newPage();
    // rewrite window.close()
    await page.exposeFunction('close', () => (
      console.info('triggered window.close()')
    ));

    page.on('requestfinished', (req) => {
      this.lastRequestResponse = req.response();
    });
  }

  /**
   * Checks if page.TimeOutError, gets page contents and returns new readable error
   * If $ms_users_inj_post_message defined shown only it's contents
   * @param e
   * @returns {Promise<*>}
   */
  async processPageError(e) {
    if (e instanceof puppeteer.errors.TimeoutError) {
      const { lastRequestResponse: lastResponse } = this;

      const statusCode = lastResponse.status();
      const lastUrl = lastResponse.url();
      const responseText = await lastResponse.text();

      const context = WebExecuter.getJavascriptContext(responseText);
      const { $ms_users_inj_post_message: serviceMessage } = context;

      let pageContents;
      if (serviceMessage !== null && typeof serviceMessage === 'object') {
        pageContents = serviceMessage;
      } else {
        pageContents = responseText;
      }

      const message = `
        ${e.message}:
        Page contents: ${util.inspect(pageContents, { depth: null })}
      `;

      return new WebExecuterTimeoutError(statusCode, message, lastUrl, pageContents, e);
    }

    return e;
  }

  /**
   * Navigates chrome to service oauth endpoint
   * Waits until the facebook login page appears
   * Enters users credentials and presses on login button
   */
  async initiateAuth(user) {
    const { _serviceLink, page } = this;
    const executeLink = `${_serviceLink}/users/oauth/facebook`;

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
      throw await this.processPageError(e);
    }
  }

  /**
   * Passes authentication process and simulates that user revokes some permission
   *
   * @param user
   * @param predicate
   * @param permissionIndex - Index of the item in the facebook permission access request to be clicked
   * @returns {Promise<*>}
   */
  async signInAndNavigate(user, predicate, permissionIndex = 2) {
    await this.initiateAuth(user);
    const { page } = this;
    let response;
    try {
      await page.waitForSelector('#platformDialogForm a[id]', { visible: true });
      await page.screenshot({ fullPage: true, path: `./ss/sandnav-initial-${Date.now()}.png` });
      await page.click('#platformDialogForm a[id]', { delay: 100 });
      await Promise.delay(300);
      await page.screenshot({ fullPage: true, path: `./ss/sandnav-before-${Date.now()}.png` });
      await page.waitForSelector(`#platformDialogForm label:nth-child(${permissionIndex})`, { visible: true });
      await page.click(`#platformDialogForm label:nth-child(${permissionIndex})`, { delay: 100 });
      await Promise.delay(300);
      await page.screenshot({ fullPage: true, path: `./ss/sandnav-after-${Date.now()}.png` });
      await page.waitForSelector('button[name=__CONFIRM__]', { visible: true });
      await page.click('button[name=__CONFIRM__]', { delay: 100 });
      response = await page.waitForResponse(predicate);
    } catch (e) {
      console.error('failed to signin and navigate', e);
      await page.screenshot({ fullPage: true, path: `./ss/sandnav-${Date.now()}.png` });
      throw await this.processPageError(e);
    }

    return response;
  }

  /**
   * When login succeeded, Facebook shows 'Application access' request form
   * Pressing `Confirm`
   * @param user
   * @returns {Promise<void>}
   */
  async authenticate(user) {
    await this.initiateAuth(user);
    await Promise.delay(1000);

    const { page } = this;
    try {
      await page.waitForSelector('button[name=__CONFIRM__]');
      await page.screenshot({ fullPage: true, path: `./ss/authenticate-accept-${Date.now()}.png` });
      await page.click('button[name=__CONFIRM__]', { delay: 100 });
    } catch (e) {
      console.error('failed to authenticate', e);
      await page.screenshot({ fullPage: true, path: `./ss/authenticate-${Date.now()}.png` });
      throw await this.processPageError(e);
    }
  }

  /**
   * Simulates situation when user declines `Application access` request form
   * @param user
   * @returns {Promise<*>}
   */
  async rejectAuth(user) {
    await this.initiateAuth(user);
    const { page } = this;
    try {
      await this.page.waitForSelector('button[name=__CANCEL__]');
      await this.page.click('button[name=__CANCEL__]');
      return await this.navigatePage();
    } catch (e) {
      console.error('failed to rejectAuth', e);
      await page.screenshot({ fullPage: true, path: `./ss/declined-${Date.now()}.png` });
      throw await this.processPageError(e);
    }
  }

  /**
   * Gets Results from `ms-users.oauth` endpoint after successful Facebook Login
   * @param user
   * @returns {Promise<{body: *, token: *}>}
   */
  async getToken(user) {
    const { page } = this;

    await this.authenticate(user);
    await Promise.all([
      this.navigatePage(), // so that refresh works, etc
      page.waitForSelector('.no-js > body > script'),
    ]);

    try {
      const body = await this.extractMsUsersPostMessage();

      assert(body.payload.token, JSON.stringify(body));

      return {
        body,
        token: body.payload.token,
      };
    } catch (e) {
      console.error('failed to getToken', e);
      await page.screenshot({ fullPage: true, path: `./ss/token-${Date.now()}.png` });
      throw await this.processPageError(e);
    }
  }

  /**
   * Executes sign-in process for active page using provided token.
   * Assuming that Auth process passed before.
   * @param token
   * @returns {Promise<{body: *, url: *, status: *}>}
   */
  async signInWithToken(token) {
    const executeLink = `${this._serviceLink}/users/oauth/facebook?jwt=${token}`;
    return this.navigatePage({ href: executeLink });
  }

  /**
   * Get ms-users oauth result variable
   * @returns {Promise<*>}
   */
  async extractMsUsersPostMessage() {
    return this.page.evaluate('window.$ms_users_inj_post_message');
  }

  /**
   * Navigates Chrome page to provided url or waits for redirect occurred
   * @param href
   * @param waitUntil
   * @returns {Promise<{body: *, url: *, status: *}>}
   */
  async navigatePage({ href, waitUntil = 'networkidle0' } = {}) {
    const { page } = this;

    if (href) {
      await page.goto(href, { waitUntil, timeout: 30000 });
    } else {
      await page.waitForNavigation({ waitUntil, timeout: 30000 });
    }

    // just to be sure
    await Promise.delay(1500);

    // maybe this is the actual request status code
    const status = this.lastRequestResponse.status();
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

  /**
   * Executes provided HTML and returns resulting Window Context.
   * @param body
   * @returns {Context}
   */
  static getJavascriptContext(body) {
    const $ = cheerio.load(body);
    const vmScript = new vm.Script($('.no-js > body > script').html());
    const context = vm.createContext({ window: { close: () => {} } });
    vmScript.runInContext(context);
    return context;
  }
}

module.exports = WebExecuter;
WebExecuter.TimeoutError = WebExecuterTimeoutError;

/* global globalRegisterUser */
const { strict: assert } = require('assert');

describe('#alias', function activateSuite() {
  before(global.startService);
  after(global.clearRedis);

  it('must reject adding alias to a non-existing user', async function test() {
    const params = { username: 'doesntexist', alias: 'marvelous' };
    await assert.rejects(this.users.dispatch('alias', { params }), {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });

  describe('user: locked', function suite() {
    const username = 'locked@me.com';

    before('add user', globalRegisterUser(username, { locked: true }));

    it('must reject adding alias to a locked user', async function test() {
      const params = { username, alias: 'marvelous' };
      await assert.rejects(this.users.dispatch('alias', { params }), {
        name: 'HttpStatusError',
        statusCode: 423,
      });
    });
  });

  describe('user: inactive', function suite() {
    const username = 'inactive@me.com';

    before(globalRegisterUser(username, { inactive: true }));

    it('must reject adding alias to an inactive user', async function test() {
      const params = { username, alias: 'marvelous' };
      await assert.rejects(this.users.dispatch('alias', { params }), {
        name: 'HttpStatusError',
        statusCode: 412,
      });
    });
  });

  describe('user: active', function suite() {
    before(globalRegisterUser('active@me.com'));
    before(globalRegisterUser('active-2@me.com'));

    it('adds alias', async function test() {
      return this.users.dispatch('alias', { params: { username: 'active@me.com', alias: 'marvelous' } });
    });

    it('returns metadata based on alias', async function test() {
      return this.users.dispatch('getMetadata', { params: { username: 'marvelous', audience: '*.localhost' } });
    });

    it('returns metadata based on username', async function test() {
      return this.users.dispatch('getMetadata', { params: { username: 'active@me.com', audience: '*.localhost' } });
    });

    it('returns public metadata based on alias', async function test() {
      return this.users.dispatch('getMetadata', { params: { public: true, username: 'marvelous', audience: '*.localhost' } });
    });

    it('returns 404 for public metadata based on username', async function test() {
      const params = { public: true, username: 'active@me.com', audience: '*.localhost' };
      await assert.rejects(this.users.dispatch('getMetadata', { params }), {
        name: 'HttpStatusError',
        statusCode: 404,
      });
    });

    it('rejects to change alias', async function test() {
      const params = { username: 'active@me.com', alias: 'filezila' };
      await assert.rejects(this.users.dispatch('alias', { params }), {
        name: 'HttpStatusError',
        statusCode: 417,
      });
    });

    it('rejects to add existing alias', async function test() {
      const params = { username: 'active-2@me.com', alias: 'marvelous' };
      await assert.rejects(this.users.dispatch('alias', { params }), {
        name: 'HttpStatusError',
        statusCode: 409,
      });
    });
  });
});

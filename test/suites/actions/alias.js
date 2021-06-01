/* global globalRegisterUser */
const { expect } = require('chai');
const { inspectPromise } = require('@makeomatic/deploy');

describe('#alias', function activateSuite() {
  before(global.startService);
  after(global.clearRedis);

  it('must reject adding alias to a non-existing user', function test() {
    return this.dispatch('users.alias', { username: 'doesntexist', alias: 'marvelous' })
      .reflect()
      .then(inspectPromise(false))
      .then((response) => {
        expect(response.name).to.be.eq('HttpStatusError');
        expect(response.statusCode).to.be.eq(404);
      });
  });

  describe('user: locked', function suite() {
    before('add user', globalRegisterUser('locked@me.com', { locked: true }));

    it('must reject adding alias to a locked user', function test() {
      return this.dispatch('users.alias', { username: 'locked@me.com', alias: 'marvelous' })
        .reflect()
        .then(inspectPromise(false))
        .then((response) => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(423);
        });
    });
  });

  describe('user: inactive', function suite() {
    before(globalRegisterUser('inactive@me.com', { inactive: true }));

    it('must reject adding alias to an inactive user', function test() {
      return this.dispatch('users.alias', { username: 'inactive@me.com', alias: 'marvelous' })
        .reflect()
        .then(inspectPromise(false))
        .then((response) => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(412);
        });
    });
  });

  describe('user: active', function suite() {
    before(globalRegisterUser('active@me.com'));
    before(globalRegisterUser('active-2@me.com'));

    it('adds alias', function test() {
      return this.dispatch('users.alias', { username: 'active@me.com', alias: 'marvelous' })
        .reflect()
        .then(inspectPromise());
    });

    it('returns metadata based on alias', function test() {
      return this.dispatch('users.getMetadata', { username: 'marvelous', audience: '*.localhost' })
        .reflect()
        .then(inspectPromise());
    });

    it('returns metadata based on username', function test() {
      return this.dispatch('users.getMetadata', { username: 'active@me.com', audience: '*.localhost' })
        .reflect()
        .then(inspectPromise());
    });

    it('returns public metadata based on alias', function test() {
      return this.dispatch('users.getMetadata', { public: true, username: 'marvelous', audience: '*.localhost' })
        .reflect()
        .then(inspectPromise());
    });

    it('returns 404 for public metadata based on username', function test() {
      return this.dispatch('users.getMetadata', { public: true, username: 'active@me.com', audience: '*.localhost' })
        .reflect()
        .then(inspectPromise(false))
        .then((response) => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(404);
        });
    });

    it('rejects to change alias', function test() {
      return this.dispatch('users.alias', { username: 'active@me.com', alias: 'filezila' })
        .reflect()
        .then(inspectPromise(false))
        .then((response) => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(417);
        });
    });

    it('rejects to add existing alias', function test() {
      return this.dispatch('users.alias', { username: 'active-2@me.com', alias: 'marvelous' })
        .reflect()
        .then(inspectPromise(false))
        .then((response) => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(409);
        });
    });
  });
});

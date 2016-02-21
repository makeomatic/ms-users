/* global inspectPromise, globalRegisterUser */
const { expect } = require('chai');

describe('#alias', function activateSuite() {
  const headers = { routingKey: 'users.alias' };

  before(global.startService);
  after(global.clearRedis);

  it('must reject adding alias to a non-existing user', function test() {
    return this
      .users
      .router({ username: 'doesntexist', alias: 'marvelous' }, headers)
      .reflect()
      .then(inspectPromise(false))
      .then(response => {
        expect(response.name).to.be.eq('HttpStatusError');
        expect(response.statusCode).to.be.eq(404);
      });
  });

  describe('user: locked', function suite() {
    before('add user', globalRegisterUser('locked@me.com', { locked: true }));

    it('must reject adding alias to a locked user', function test() {
      return this
        .users
        .router({ username: 'locked@me.com', alias: 'marvelous' }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(response => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(423);
        });
    });
  });

  describe('user: inactive', function suite() {
    before(globalRegisterUser('inactive@me.com', { inactive: true }));

    it('must reject adding alias to an inactive user', function test() {
      return this
        .users
        .router({ username: 'inactive@me.com', alias: 'marvelous' }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(response => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(412);
        });
    });
  });

  describe('user: active', function suite() {
    before(globalRegisterUser('active@me.com'));
    before(globalRegisterUser('active-2@me.com'));

    it('adds alias', function test() {
      return this
        .users
        .router({ username: 'active@me.com', alias: 'marvelous' }, headers)
        .reflect()
        .then(inspectPromise());
    });

    it('rejects to change alias', function test() {
      return this
        .users
        .router({ username: 'active@me.com', alias: 'filezila' }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(response => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(417);
        });
    });

    it('rejects to add existing alias', function test() {
      return this
        .users
        .router({ username: 'active-2@me.com', alias: 'marvelous' }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(response => {
          expect(response.name).to.be.eq('HttpStatusError');
          expect(response.statusCode).to.be.eq(409);
        });
    });
  });
});

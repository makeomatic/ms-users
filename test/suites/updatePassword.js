/* global inspectPromise */
const { expect } = require('chai');
const redisKey = require('../../src/utils/key.js');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#updatePassword', function updatePasswordSuite() {
  const username = 'v@makeomatic.ru';
  const password = '123';
  const audience = '*.localhost';
  const emailValidation = require('../../src/utils/send-email.js');
  const { USERS_BANNED_FLAG, USERS_ACTIVE_FLAG, USERS_DATA } = require('../../src/constants.js');

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function pretest() {
    return simpleDispatcher(this.users.router)('users.register', { username, password, audience });
  });

  it('must reject updating password for a non-existing user on username+password update', function test() {
    return simpleDispatcher(this.users.router)('users.updatePassword', { username: 'mcdon@tour.de.france', currentPassword: 'xxx', newPassword: 'vvv' })
      .reflect()
      .then(inspectPromise(false))
      .then(updatePassword => {
        expect(updatePassword.name).to.be.eq('HttpStatusError');
        expect(updatePassword.statusCode).to.be.eq(404);
      });
  });

  describe('user: inactive', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(username, USERS_DATA), USERS_ACTIVE_FLAG, 'false');
    });

    it('must reject updating password for an inactive account on username+password update', function test() {
      return simpleDispatcher(this.users.router)('users.updatePassword', { username, currentPassword: password, newPassword: 'vvv' })
        .reflect()
        .then(inspectPromise(false))
        .then(updatePassword => {
          expect(updatePassword.name).to.be.eq('HttpStatusError');
          expect(updatePassword.statusCode).to.be.eq(412);
        });
    });
  });

  describe('user: banned', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(username, USERS_DATA), USERS_BANNED_FLAG, 'true');
    });

    it('must reject updating password for an inactive account on username+password update', function test() {
      return simpleDispatcher(this.users.router)('users.updatePassword', { username, currentPassword: password, newPassword: 'vvv' })
        .reflect()
        .then(inspectPromise(false))
        .then(updatePassword => {
          expect(updatePassword.name).to.be.eq('HttpStatusError');
          expect(updatePassword.statusCode).to.be.eq(423);
        });
    });
  });

  describe('user: active', function suite() {
    it('must reject updating password with an invalid username/password combination', function test() {
      return simpleDispatcher(this.users.router)('users.updatePassword', { username, currentPassword: 'xxx', newPassword: 'vvv' })
        .reflect()
        .then(inspectPromise(false))
        .then(updatePassword => {
          expect(updatePassword.name).to.be.eq('HttpStatusError');
          expect(updatePassword.statusCode).to.be.eq(403);
        });
    });

    it('must update password with a valid username/password combination and different newPassword', function test() {
      return simpleDispatcher(this.users.router)('users.updatePassword', { username, currentPassword: password, newPassword: 'vvv', remoteip: '10.0.0.0' })
        .reflect()
        .then(inspectPromise())
        .then(updatePassword => {
          expect(updatePassword).to.be.deep.eq({ success: true });
        });
    });

    describe('token', function tokenSuite() {
      beforeEach(function pretest() {
        return emailValidation.send.call(this.users, username, 'reset').then(data => {
          this.token = data.context.qs.slice(3);
        });
      });

      it('must reject updating password for an invalid challenge token', function test() {
        return simpleDispatcher(this.users.router)('users.updatePassword', { resetToken: 'wrong', newPassword: 'vvv' })
          .reflect()
          .then(inspectPromise(false))
          .then(updatePassword => {
            expect(updatePassword.name).to.be.eq('HttpStatusError');
            expect(updatePassword.statusCode).to.be.eq(403);
          });
      });

      it('must update password passed with a valid challenge token', function test() {
        return simpleDispatcher(this.users.router)('users.updatePassword', { resetToken: this.token, newPassword: 'vvv' })
          .reflect()
          .then(inspectPromise())
          .then(updatePassword => {
            expect(updatePassword).to.be.deep.eq({ success: true });
          });
      });
    });
  });
});

/* global inspectPromise */
const { expect } = require('chai');

describe('#updatePassword', function updatePasswordSuite() {
  const { User } = require('../../src/model/usermodel');
  const headers = { routingKey: 'users.updatePassword' };
  const username = 'v@makeomatic.ru';
  const password = '123';
  const audience = '*.localhost';
  const emailValidation = require('../../src/utils/send-email.js');
  const { USERS_BANNED_FLAG, USERS_ACTIVE_FLAG, USERS_DATA } = require('../../src/constants.js');

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function pretest() {
    return this.users.router({ username, password, audience }, { routingKey: 'users.register' });
  });

  it('must reject updating password for a non-existing user on username+password update', function test() {
    return this.users.router({ username: 'mcdon@tour.de.france', currentPassword: 'xxx', newPassword: 'vvv' }, headers)
      .reflect()
      .then(inspectPromise(false))
      .then(updatePassword => {
        expect(updatePassword.name).to.be.eq('HttpStatusError');
        expect(updatePassword.statusCode).to.be.eq(404);
      });
  });

  describe('user: inactive', function suite() {
    beforeEach(function pretest() {
      return User.disactivate.call(this.users, username);
    });

    it('must reject updating password for an inactive account on username+password update', function test() {
      return this.users.router({ username, currentPassword: password, newPassword: 'vvv' }, headers)
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
      return User.lock.call(this.users, { username });
    });

    it('must reject updating password for an inactive account on username+password update', function test() {
      return this.users.router({ username, currentPassword: password, newPassword: 'vvv' }, headers)
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
      return this.users.router({ username, currentPassword: 'xxx', newPassword: 'vvv' }, headers)
        .reflect()
        .then(inspectPromise(false))
        .then(updatePassword => {
          expect(updatePassword.name).to.be.eq('HttpStatusError');
          expect(updatePassword.statusCode).to.be.eq(403);
        });
    });

    it('must update password with a valid username/password combination and different newPassword', function test() {
      return this.users.router({ username, currentPassword: password, newPassword: 'vvv', remoteip: '10.0.0.0' }, headers)
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
        return this.users.router({ resetToken: 'wrong', newPassword: 'vvv' }, headers)
          .reflect()
          .then(inspectPromise(false))
          .then(updatePassword => {
            expect(updatePassword.name).to.be.eq('HttpStatusError');
            expect(updatePassword.statusCode).to.be.eq(403);
          });
      });

      it('must update password passed with a valid challenge token', function test() {
        return this.users.router({ resetToken: this.token, newPassword: 'vvv' }, headers)
          .reflect()
          .then(inspectPromise())
          .then(updatePassword => {
            expect(updatePassword).to.be.deep.eq({ success: true });
          });
      });
    });
  });
});

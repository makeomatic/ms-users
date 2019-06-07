const { inspectPromise } = require('@makeomatic/deploy');
const assert = require('assert');
const Promise = require('bluebird');
const { expect } = require('chai');
const redisKey = require('../../src/utils/key.js');
const simpleDispatcher = require('./../helpers/simpleDispatcher');

describe('#updatePassword', function updatePasswordSuite() {
  const challenge = require('../../src/utils/challenges/challenge.js');
  const { USERS_BANNED_FLAG, USERS_ACTIVE_FLAG, USERS_DATA } = require('../../src/constants.js');

  const username = 'v@makeomatic.ru';
  const password = '123';
  const audience = '*.localhost';

  beforeEach(global.startService);
  afterEach(global.clearRedis);

  beforeEach(function pretest() {
    return simpleDispatcher(this.users.router)('users.register', { username, password, audience })
      .then(({ user }) => { this.userId = user.id; });
  });

  it('must reject updating password for a non-existing user on username+password update', function test() {
    const dispatch = simpleDispatcher(this.users.router);
    const params = { username: 'mcdon@tour.de.france', currentPassword: 'xxx', newPassword: 'vvv' };

    return dispatch('users.updatePassword', params)
      .reflect()
      .then(inspectPromise(false))
      .then((updatePassword) => {
        expect(updatePassword.name).to.be.eq('HttpStatusError');
        expect(updatePassword.statusCode).to.be.eq(404);
      });
  });

  describe('user: inactive', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(this.userId, USERS_DATA), USERS_ACTIVE_FLAG, 'false');
    });

    it('must reject updating password for an inactive account on username+password update', function test() {
      return simpleDispatcher(this.users.router)('users.updatePassword', { username, currentPassword: password, newPassword: 'vvv' })
        .reflect()
        .then(inspectPromise(false))
        .then((updatePassword) => {
          expect(updatePassword.name).to.be.eq('HttpStatusError');
          expect(updatePassword.statusCode).to.be.eq(412);
        });
    });
  });

  describe('user: banned', function suite() {
    beforeEach(function pretest() {
      return this.users.redis.hset(redisKey(this.userId, USERS_DATA), USERS_BANNED_FLAG, 'true');
    });

    it('must reject updating password for an inactive account on username+password update', function test() {
      return simpleDispatcher(this.users.router)('users.updatePassword', { username, currentPassword: password, newPassword: 'vvv' })
        .reflect()
        .then(inspectPromise(false))
        .then((updatePassword) => {
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
        .then((updatePassword) => {
          expect(updatePassword.name).to.be.eq('HttpStatusError');
          expect(updatePassword.statusCode).to.be.eq(403);
        });
    });

    it('must update password with a valid username/password combination and different newPassword', function test() {
      const params = { username, currentPassword: password, newPassword: 'vvv', remoteip: '10.0.0.0' };

      return simpleDispatcher(this.users.router)('users.updatePassword', params)
        .reflect()
        .then(inspectPromise())
        .then((updatePassword) => {
          expect(updatePassword).to.be.deep.eq({ success: true });
        });
    });

    describe('token', function tokenSuite() {
      beforeEach(function pretest() {
        return challenge
          .call(this.users, 'email', {
            id: username,
            action: 'reset',
          })
          .then((data) => {
            this.token = data.context.token.secret;
          });
      });

      it('must reject updating password for an invalid challenge token', function test() {
        return simpleDispatcher(this.users.router)('users.updatePassword', { resetToken: 'wrong', newPassword: 'vvv' })
          .reflect()
          .then(inspectPromise(false))
          .then((updatePassword) => {
            expect(updatePassword.name).to.be.eq('HttpStatusError');
            expect(updatePassword.statusCode).to.be.eq(403);
          });
      });

      it('must update password passed with a valid challenge token', function test() {
        return simpleDispatcher(this.users.router)('users.updatePassword', { resetToken: this.token, newPassword: 'vvv' })
          .reflect()
          .then(inspectPromise())
          .then((updatePassword) => {
            expect(updatePassword).to.be.deep.eq({ success: true });
          });
      });

      it('must drop login counter after updating password', async function test() {
        const remoteip = '10.0.0.1';
        const userWithRemoteIP = { username, password: 'wrongPassword', remoteip, audience };
        const dispatch = simpleDispatcher(this.users.router);

        // eslint-disable-next-line no-unused-vars
        const attempt = (_, i) => dispatch(
          'users.login',
          // 5 attempts to local lock and 10 404s for global
          i < 5 ? userWithRemoteIP : { ...userWithRemoteIP, username: '404' }
        )
          .reflect()
          .then(inspectPromise(false));

        await Promise.all(
          Array(15).fill(0).map(attempt)
        );

        const newPassword = 'vvv';
        // it should drop counter
        await dispatch('users.updatePassword', { resetToken: this.token, newPassword, remoteip })
          .reflect()
          .then(inspectPromise());

        await assert.doesNotReject(
          dispatch('users.login', { ...userWithRemoteIP, password: newPassword })
        );
      });
    });
  });
});

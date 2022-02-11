const { strict: assert } = require('assert');
const Promise = require('bluebird');

describe('#challenge', function challengeSuite() {
  beforeEach(global.startService.bind(this));
  afterEach(global.clearRedis.bind(this));

  it('must fail to send a challenge for a non-existing user', async () => {
    const request = this.users.dispatch('challenge', { params: { username: 'oops@gmail.com', type: 'email' } });
    await assert.rejects(request, {
      name: 'HttpStatusError',
      statusCode: 404,
    });
  });

  describe('challenge for an already active user', () => {
    beforeEach('register user', () => {
      return this.users.dispatch('register', { params: {
        username: 'oops@gmail.com',
        password: '123',
        audience: 'matic.ninja',
        metadata: {
          wolf: true,
        },
      } });
    });

    it('must fail to send', async () => {
      const request = this.users.dispatch('challenge', { params: { username: 'oops@gmail.com', type: 'email' } });
      await assert.rejects(request, {
        name: 'HttpStatusError',
        statusCode: 417,
      });
    });
  });

  describe('challenge for an inactive user', () => {
    const requestChallenge = () => {
      return this.users.dispatch('challenge', { params: { username: 'oops@gmail.com', type: 'email' } });
    };

    beforeEach('register user', () => {
      const msg = {
        username: 'oops@gmail.com',
        password: '123',
        audience: 'matic.ninja',
        activate: false,
        skipChallenge: true,
        metadata: {
          wolf: true,
        },
      };
      return this.users.dispatch('register', { params: msg });
    });

    it('must be able to send challenge email', async () => {
      const validation = await requestChallenge();
      assert.ok(validation.context);
      assert.equal(validation.queued, true);
    });

    it('must fail to send challenge email more than once in an hour per user', async () => {
      const msg = 'We\'ve already sent you an email, if it doesn\'t come - please try again in 2 hours or send us an email';

      await requestChallenge();
      const secondRequest = requestChallenge();

      await assert.rejects(secondRequest, {
        name: 'HttpStatusError',
        statusCode: 429,
        message: msg,
      });
    });

    it('must fail to send challeng email during race condition', async () => {
      const msg = 'We\'ve already sent you an email, if it doesn\'t come - please try again in 2 hours or send us an email';
      const raceRequest = Promise.all([requestChallenge(), requestChallenge(), requestChallenge()]);

      await assert.rejects(raceRequest, {
        name: 'HttpStatusError',
        statusCode: 429,
        message: msg,
      });
    });
  });

  describe('challenge for an inactive user passes metadata', () => {
    const msg = {
      username: 'oops@gmail.com',
      password: '123',
      audience: '*.localhost', // should match default audience
      activate: false,
      skipChallenge: true,
      metadata: {
        firstName: 'FooUser',
        lastName: 'BarName',
      },
    };

    const requestChallenge = () => {
      return this.users.dispatch('challenge', { params: { username: 'oops@gmail.com', type: 'email' } });
    };

    beforeEach('register user', () => {
      return this.users.dispatch('register', { params: { ...msg } });
    });

    it('metadata passed correctly', async () => {
      const { context } = await requestChallenge();
      const { metadata } = msg;

      assert.equal(context.firstName, metadata.firstName);
      assert.equal(context.lastName, metadata.lastName);
    });
  });
});

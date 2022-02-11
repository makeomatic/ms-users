/* global startService, clearRedis */
const Promise = require('bluebird');
const { times } = require('lodash');
const { strictEqual } = require('assert');

describe('#login-rate-limiter', function rateLimiterSuite() {
  const user = { username: 'v@makeomatic.ru', password: 'nicepassword', audience: '*.localhost' };
  const userWithValidPassword = { username: 'v@makeomatic.ru', password: 'nicepassword1', audience: '*.localhost' };

  describe('extra data cleanup', () => {
    let userId;

    before(async () => {
      await startService.call(this);
    });

    after(clearRedis.bind(this));

    beforeEach(async () => {
      const { user: loginUser } = await this.users
        .dispatch('register', { params: userWithValidPassword });
      userId = loginUser.id;
    });

    afterEach(clearRedis.bind(this, true));

    it('saves user ips and deletes associated global locks', async () => {
      const { redis } = this.users;
      const userWithRemoteIP = { remoteip: '10.0.0.1', ...user };
      const userWithIPAndValidPassword = { ...userWithRemoteIP, ...userWithValidPassword };
      const promises = [];

      times(10, (index) => {
        promises.push(
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP, remoteip: `10.0.0.${index + 1}` } })
        );
        promises.push(
          this.users
            .dispatch('login', { params: { ...userWithRemoteIP, remoteip: `10.0.0.${index + 1}`, username: 'perchik@ya.ru' } })
        );
      });

      await Promise.allSettled(promises);

      strictEqual(await redis.zrange(`${userId}!ip!10.0.0.1`, 0, -1).get('length'), 1);
      strictEqual(await redis.zrange(`${userId}!ip!10.0.0.2`, 0, -1).get('length'), 1);
      strictEqual(await redis.zrange(`${userId}!ip!10.0.0.3`, 0, -1).get('length'), 1);

      strictEqual(await redis.zrange('gl!ip!ctr!10.0.0.1', 0, -1).get('length'), 2);
      strictEqual(await redis.zrange('gl!ip!ctr!10.0.0.2', 0, -1).get('length'), 2);
      strictEqual(await redis.zrange('gl!ip!ctr!10.0.0.3', 0, -1).get('length'), 2);

      await this.users.dispatch('login', { params: userWithIPAndValidPassword });

      strictEqual(await redis.zrange(`${userId}!ip!10.0.0.1`, 0, -1).get('length'), 0);
      strictEqual(await redis.zrange(`${userId}!ip!10.0.0.2`, 0, -1).get('length'), 1);
      strictEqual(await redis.zrange(`${userId}!ip!10.0.0.3`, 0, -1).get('length'), 1);

      strictEqual(await redis.zrange('gl!ip!ctr!10.0.0.1', 0, -1).get('length'), 1);
      strictEqual(await redis.zrange('gl!ip!ctr!10.0.0.2', 0, -1).get('length'), 2);
      strictEqual(await redis.zrange('gl!ip!ctr!10.0.0.3', 0, -1).get('length'), 2);
    });
  });
});

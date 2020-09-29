describe('#cloudflare.add-to-list action', () => {
  /* Restart service before each test to achieve clean database. */
  before('start', async () => {
    await global.startService.call(this, {
      cfList: { enabled: true, worker: { enabled: false } },
    });
  });

  after('stop', async () => {
    await global.clearRedis.call(this, false);
  });

  it('should add ip', async () => {
    await this.dispatch('users.cf.add-to-list', { remoteip: '8.8.8.8' });
    await this.dispatch('users.cf.add-to-list', { remoteip: '8.8.8.9' });

    const { redis } = this.users;
    const result = await redis.hgetall('cf:ip-to-list');
    console.debug('hgetall', result);
  });

  it('should touch ip', async () => {
    await this.dispatch('users.cf.add-to-list', { remoteip: '8.8.8.8' });

    const { redis } = this.users;
    const result = await redis.hgetall('cf:ip-to-list');
    console.debug('hgetall', result);
  });
});

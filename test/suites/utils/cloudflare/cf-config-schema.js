const { throws } = require('assert');

describe('#cloudflare access-list configuration', () => {
  const testSchema = 'test-schema';
  const schema = {
    $ref: 'config#/definitions/cfAccessList',
  };

  before(async () => {
    const service = await global
      .startService
      .call(this, { cfAccessList: { enabled: false } });

    service.validator.$ajv.addSchema(schema, testSchema);
    this.validate = (config) => () => service.validator.ifError(testSchema, config);
  });

  after(async () => {
    await this.users.close();
  });

  it('should not validate config when disabled', async () => {
    this.validate({
      enabled: false,
    });
  });

  describe('auth config', () => {
    const key = '#valid-key';
    const baseConfig = {
      enabled: true,
      worker: { enabled: false },
    };

    it('empty object', () => {
      throws(this.validate({
        ...baseConfig,
        auth: {},
      }), /data.auth should match some schema in anyOf/);
    });

    it('`auth.serviceKey` string', () => {
      throws(this.validate({
        ...baseConfig,
        auth: {
          serviceKey: 42,
        },
      }), /data.auth.serviceKey should be string/);
    });

    it('`auth.token` string', () => {
      throws(this.validate({
        ...baseConfig,
        auth: {
          token: 42,
        },
      }), /data.auth.token should be string/);
    });

    it('`auth.{email|key}` pair', () => {
      throws(this.validate({
        ...baseConfig,
        auth: { key },
      }), /data.auth should have required property 'email'/);

      throws(this.validate({
        ...baseConfig,
        auth: {
          email: 123,
          key,
        },
      }), /data.auth.email should be string/);

      throws(this.validate({
        ...baseConfig,
        auth: {
          email: 'invalid',
          key,
        },
      }), /data.auth.email should match format "email"/);

      throws(this.validate({
        ...baseConfig,
        auth: {
          email: 'valid@mail.com',
          key: 42,
        },
      }), /data.auth.key should be string/);
    });
  });

  describe('accessList config', () => {
    /* eslint-disable max-len */
    const baseConfig = {
      enabled: true,
      worker: { enabled: false, cleanupInterval: 10000, concurrency: 10 },
      auth: { token: '#valid-token' },
    };

    it('`accessList`', () => {
      throws(this.validate({
        ...baseConfig,
      }), /data should have required property 'accessList'/);
    });

    it('`accessList` as empty object', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {},
      }), /data.accessList should have required property 'accountId', data.accessList should have required property 'ttl', data.accessList should have required property 'listCacheTTL'/);
    });

    it('`accessList.prefix`', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {
          prefix: 42,
          accountId: '#valid-account-id',
        },
      }), /data.accessList.prefix should be string/);
    });

    it('`accessList.accountId`', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: 42,
        },
      }), /data.accessList.accountId should be string/);

      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: 'invalid',
        },
      }), /data.accessList.accountId should NOT be shorter than 10 characters/);
    });

    it('`accessList.ttl`', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: '#valid-account-id',
          ttl: null,
        },
      }), /data.accessList.ttl should be number/);

      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: '#valid-account-id',
          ttl: 59000,
        },
      }), /data.accessList.ttl should be >= 60000/);
    });

    it('`accessList.listCacheTTL`', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: '#valid-account-id',
          listCacheTTL: null,
        },
      }), /data.accessList.listCacheTTL should be number/);

      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: '#valid-account-id',
          listCacheTTL: 14999,
        },
      }), /data.accessList.listCacheTTL should be >= 15000/);
    });
    /* eslint-enable max-len */
  });

  describe('worker config', () => {
    const baseConfig = {
      enabled: true,
      worker: { enabled: false },
      auth: { token: '#valid-token' },
      accessList: { accountId: '#valid-account-id' },
    };

    it('`worker`', () => {
      throws(this.validate({
        ...baseConfig,
        worker: {},
      }), /data.worker should have required property 'enabled'/);
    });

    it('`worker.cleanupInterval`', () => {
      throws(this.validate({
        ...baseConfig,
        worker: {
          ...baseConfig.worker,
          cleanupInterval: 'string',
        },
      }), /data.worker.cleanupInterval should be number/);

      throws(this.validate({
        ...baseConfig,
        worker: {
          ...baseConfig.worker,
          cleanupInterval: 1999,
        },
      }), /data.worker.cleanupInterval should be >= 2000/);
    });

    it('`worker.concurrency`', () => {
      throws(this.validate({
        ...baseConfig,
        worker: {
          ...baseConfig.worker,
          concurrency: 'string',
        },
      }), /data.worker.concurrency should be number/);

      throws(this.validate({
        ...baseConfig,
        worker: {
          ...baseConfig.worker,
          concurrency: 0,
        },
      }), /data.worker.concurrency should be >= 1/);
    });
  });
});

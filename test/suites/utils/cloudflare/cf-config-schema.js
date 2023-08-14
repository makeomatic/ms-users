const { throws } = require('assert');
const { startService } = require('../../../config');

describe('#cloudflare access-list configuration', function cfAccessListSuite() {
  const testSchema = 'test-schema';
  const schema = {
    $ref: 'config#/definitions/cfAccessList',
  };

  before(async () => {
    const service = await startService
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
      }), /data\/auth must match a schema in anyOf/);
    });

    it('`auth.serviceKey` string', () => {
      throws(this.validate({
        ...baseConfig,
        auth: {
          serviceKey: { ahhhaha: true },
        },
      }), /data\/auth\/serviceKey must be string/);
    });

    it('`auth.token` string', () => {
      throws(this.validate({
        ...baseConfig,
        auth: {
          token: { ahhhaha: true },
        },
      }), /data\/auth.token must be string/);
    });

    it('`auth.{email|key}` pair', () => {
      throws(this.validate({
        ...baseConfig,
        auth: { key },
      }), /data\/auth must have required property 'email'/);

      throws(this.validate({
        ...baseConfig,
        auth: {
          email: { ahhhaha: true },
          key,
        },
      }), /data\/auth\/email must be string/);

      throws(this.validate({
        ...baseConfig,
        auth: {
          email: 'invalid',
          key,
        },
      }), /data\/auth\/email must match format "email"/);

      throws(this.validate({
        ...baseConfig,
        auth: {
          email: 'valid@mail.com',
          key: { ahhhaha: true },
        },
      }), /data\/auth\/key must be string/);
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
      }), /data must have required property 'accessList'/);
    });

    it('`accessList` as empty object', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {},
      }), /data\/accessList must have required property 'accountId', data\/accessList must have required property 'ttl', data\/accessList must have required property 'listCacheTTL'/);
    });

    it('`accessList.prefix`', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {
          prefix: { ahhhaha: true },
          accountId: '#valid-account-id',
        },
      }), /data\/accessList\/prefix must be string/);
    });

    it('`accessList.accountId`', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: { ahhhaha: true },
        },
      }), /data\/accessList\/accountId must be string/);

      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: 'invalid',
        },
      }), /data\/accessList\/accountId must NOT have fewer than 10 characters/);
    });

    it('`accessList.ttl`', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: '#valid-account-id',
          ttl: { coerce: false },
        },
      }), /data\/accessList\/ttl must be number/);

      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: '#valid-account-id',
          ttl: 59000,
        },
      }), /data\/accessList\/ttl must be >= 60000/);
    });

    it('`accessList.listCacheTTL`', () => {
      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: '#valid-account-id',
          listCacheTTL: { coerce: false },
        },
      }), /data\/accessList\/listCacheTTL must be number/);

      throws(this.validate({
        ...baseConfig,
        accessList: {
          accountId: '#valid-account-id',
          listCacheTTL: 14999,
        },
      }), /data\/accessList\/listCacheTTL must be >= 15000/);
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
      }), /data\/worker must have required property 'enabled'/);
    });

    it('`worker.cleanupInterval`', () => {
      throws(this.validate({
        ...baseConfig,
        worker: {
          ...baseConfig.worker,
          cleanupInterval: 'string',
        },
      }), /data\/worker\/cleanupInterval must be number/);

      throws(this.validate({
        ...baseConfig,
        worker: {
          ...baseConfig.worker,
          cleanupInterval: 1999,
        },
      }), /data\/worker\/cleanupInterval must be >= 2000/);
    });

    it('`worker.concurrency`', () => {
      throws(this.validate({
        ...baseConfig,
        worker: {
          ...baseConfig.worker,
          concurrency: 'string',
        },
      }), /data\/worker\/concurrency must be number/);

      throws(this.validate({
        ...baseConfig,
        worker: {
          ...baseConfig.worker,
          concurrency: 0,
        },
      }), /data\/worker\/concurrency must be >= 1/);
    });
  });
});

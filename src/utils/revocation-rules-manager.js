const { assert } = require('chai');
const { chunk } = require('lodash');
const { once } = require('events');

const { KEY_PREFIX_INVOCATION_RULES } = require('../constants');

const DONE_EVENT = 'ir-job-done';

const TRX_LIMIT = 64;

const userRule = (userId, ruleId) => `u/${userId}/${ruleId}`;
const globalRule = (ruleId) => `g/${ruleId}`;
const extractId = (consulRule) => consulRule.Key.split('/').pop();
const extractRule = (consulRule) => ({
  rule: extractId(consulRule),
  params: {
    ...JSON.parse(consulRule.Value),
    ttl: consulRule.Flags,
  },
});

class RevocationRulesManager {
  constructor(config, whenLeader, consul, log) {
    this.log = log;
    this.consul = consul;
    this.prefix = KEY_PREFIX_INVOCATION_RULES;
    this.expireJob = null;
    this.config = config;
    this.whenLeader = whenLeader;
  }

  _getKey(key) {
    return `${this.prefix}${key}`;
  }

  async list(prefix = '', recurse = true) {
    const params = {
      key: this._getKey(prefix),
      recurse,
    };
    return this.consul.kv.get(params);
  }

  async get(key) {
    return this.consul.kv.get({
      key: this._getKey(key),
    });
  }

  async set(key, obj, flags = 0) {
    const response = await this.consul.kv.set({
      key: this._getKey(key),
      value: obj,
      flags,
    });

    return response;
  }

  async batchDelete(keys) {
    return this._batchDelete(keys.map((k) => this._getKey(k)));
  }

  async _batchDelete(keys) {
    assert(Array.isArray(keys), 'keys should be array');

    if (keys.length === 0) return null;
    const operations = keys.map((k) => ({
      KV: {
        Verb: 'delete-tree',
        Key: k.replace(/\/$/, ''),
      },
    }));
    const result = await this.consul.transaction.create(operations);

    return result;
  }

  async expire(ttl) {
    const allKeys = await this.list();
    const expiredKeys = allKeys
      .filter(({ Flags }) => Flags > 0 && Flags < ttl)
      .map(({ Key }) => Key);

    const chunks = chunk(expiredKeys, TRX_LIMIT);

    const promises = chunks
      .map((c) => this._batchDelete(c).catch((err) => {
        this.log.info({ err }, 'Batch delete error');
      }));

    await Promise.all(promises);
  }

  async scheduleExpire() {
    try {
      if (await this.whenLeader()) {
        this.log.debug('performing rule cleanup');
        this.active = true;

        await this.expire(Date.now());
      }
    } catch (err) {
      this.log({ err }, 'recurrent expire job error');
    } finally {
      this.active = false;
      this.expireJob = setTimeout(this.scheduleExpire.bind(this), this.config.cleanupInterval);
      this.service.emit(DONE_EVENT);
    }
  }

  async startRecurrentJobs() {
    this.scheduleExpire();
  }

  async stopRecurrentJobs() {
    if (this.active) {
      await once(DONE_EVENT);
    }
    clearTimeout(this.expireJob);
  }
}

module.exports = {
  RevocationRulesManager,
  userRule,
  globalRule,
  extractId,
  extractRule,
};

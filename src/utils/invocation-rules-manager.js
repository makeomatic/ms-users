const { assert } = require('chai');
const { chunk } = require('lodash');
const { once } = require('events');

const { KEY_PREFIX_INVOCATION_RULES } = require('../constants');

const DONE_EVENT = 'ir-job-done';

const TRX_LIMIT = 64;

class InvocationRulesManager {
  constructor(service, log) {
    this.service = service;
    this.consul = service.consul;
    this.log = log;

    this.prefix = KEY_PREFIX_INVOCATION_RULES;
    this.expireJob = null;
  }

  _getKey(key) {
    return `${this.prefix}/${key}`;
  }

  async list(prefix) {
    return this.consul.kv.get({
      key: prefix,
      recurse: true,
    });
  }

  async get(key) {
    return this.consul.kv.get({
      key: this._getKey(key),
    });
  }

  async set(key, obj, flag) {
    return this.consul.set({
      key: this._getKey(key),
      value: JSON.stringify(obj),
      flag,
    });
  }

  async batchDelete(keys) {
    return this.batchDelete(keys.map((k) => this._getKey(k)));
  }

  async _batchDelete(keys) {
    assert(Array.isArray(keys), 'keys should be array');

    if (keys.length === 0) return null;

    return this.consul.transaction.create({
      operations: keys.map((k) => ({
        KV: {
          Verb: 'delete',
          Key: k,
        },
      })),
    });
  }

  async expire(prefix, ttl) {
    const allKeys = await this.list(this._getKey(prefix));
    const expiredKeys = allKeys.filter(({ flags }) => flags < ttl);

    const chunks = chunk(expiredKeys, TRX_LIMIT);

    const promises = chunks.map((c) => this.batchDelete(c).catch((err) => {
      this.log.info({ err }, 'Batch delete error');
    }));

    await Promise.all(promises);
  }

  async scheduleExpire() {
    try {
      if (await this.service.whenLeader()) {
        this.active = true;
        this.expire('', Date.now());
      }
    } catch (err) {
      this.log({ err }, 'recurrent expire job error');
    } finally {
      this.active = false;
      this.expireJob = setTimeout(() => {}, 10000);
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
  InvocationRulesManager,
};

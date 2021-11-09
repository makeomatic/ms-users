const { assert } = require('chai');
const { chunk } = require('lodash');
const { once } = require('events');

const { KEY_PREFIX_INVOCATION_RULES } = require('../constants');

const DONE_EVENT = 'rrm-ttl-job-done';

// Consul trasaction operation limit
const TRX_LIMIT = 64;

// keys
const userRule = (userId, ruleId) => `u/${userId}/${ruleId}`;
const globalRule = (ruleId) => `g/${ruleId}`;

// utils
const extractId = (consulRule) => consulRule.Key.split('/').pop();

/**
 * Converts consul key to specific response, key.Value parsed using JSON.parse
 * @param {Object} consulRule
 * @returns {{rule: string, params: Record<string, any>}
 */
const extractRule = (consulRule) => ({
  rule: extractId(consulRule),
  params: {
    ...JSON.parse(consulRule.Value),
    ttl: consulRule.Flags,
  },
});

/**
 * Manages revocation rules using consul kv.
 */
class RevocationRulesManager {
  /**
   * @param {Objec} config revocationRulesManager section
   * @param {*} whenLeader bound microfleet.whenLeader
   * @param {*} consul plugin-consul reference
   * @param {*} log plugin-log
   */
  constructor(config, whenLeader, consul, log) {
    this.log = log;
    this.consul = consul;
    this.prefix = KEY_PREFIX_INVOCATION_RULES;
    this.expireRuleJob = null;
    this.config = config;
    this.whenLeader = whenLeader;
  }

  _getKey(key) {
    return `${this.prefix}${key}`;
  }

  /**
   * Returns list of Consul.KV keys.
   * @param {string} kv key
   * @param {boolean} recurse recurse tree walk
   * @returns Object[]
   */
  async list(key = '', recurse = true) {
    const params = {
      key: this._getKey(key),
      recurse,
    };
    return this.consul.kv.get(params);
  }

  /**
   * Gets requested key from Consul.KV
   * @param {String} key Consul.KV key
   * @returns Object
   */
  async get(key) {
    return this.consul.kv.get({
      key: this._getKey(key),
    });
  }

  /**
   *
   * @param {String} key Consul.KV key
   * @param {String} jsonEncoded JSON.encode'd value to save
   * @param {number} ttl Timestamp when key should expire
   * @returns
   */
  async set(key, jsonEncoded, ttl = 0) {
    const response = await this.consul.kv.set({
      key: this._getKey(key),
      value: jsonEncoded,
      flags: ttl,
    });

    return response;
  }

  /**
   * Deletes provided keys
   * @param {String[]} keys to delete
   * @returns
   */
  async batchDelete(keys) {
    return this._batchDelete(keys.map((k) => this._getKey(k)));
  }

  async _batchDelete(keys) {
    assert(Array.isArray(keys), 'keys should be array');

    if (keys.length === 0) return null;

    const { consul } = this;
    const operations = keys.map((k) => ({
      KV: {
        Verb: 'delete-tree',
        Key: k.replace(/\/$/, ''),
      },
    }));

    return consul.transaction.create(operations);
  }

  /**
   * Deletes keys with ttl < provided value
   * @param {number} ttl - timestamp
   */
  async expire(ttl) {
    // TODO: Consider partial keys fetch
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

  /**
   * Schedules recurrent cleanup job.
   */
  async scheduleExpire() {
    try {
      if (await this.whenLeader()) {
        this.log.debug('performing rule cleanup');
        this.active = true;

        await this.expire(Date.now());
      }
    } catch (err) {
      this.log.error({ err }, 'recurrent expire job error');
    } finally {
      this.active = false;
      this.expireRuleJob = setTimeout(this.scheduleExpire.bind(this), this.config.cleanupInterval);
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
    clearTimeout(this.expireRuleJob);
  }
}

module.exports = {
  RevocationRulesManager,
  userRule,
  globalRule,
  extractId,
  extractRule,
};

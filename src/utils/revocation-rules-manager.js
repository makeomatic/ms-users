const { chunk } = require('lodash');

const { KEY_PREFIX_REVOCATION_RULES } = require('../constants');

const handlePipelineError = require('./pipeline-error');

const REDIS_KEY_PREFIX = 'jwt-rules';
const GLOBAL_RULE_GROUP = 'g';

/**
 * Manages revocation rules using Redis and Consul kv.
 */
class RevocationRulesManager {
  /**
   * @param {Object} config revocationRulesManager section
   * @param {Microfleet} microfleet service
   */
  constructor(service) {
    this.service = service;
    this.log = service.log;
    this.consul = service.consul;
    this.redis = service.redis;
    this.consulKeyPrefix = KEY_PREFIX_REVOCATION_RULES;
    this.keyPrefix = REDIS_KEY_PREFIX;
  }

  _getConsulKey(key) {
    return `${this.consulKeyPrefix}${key}`;
  }

  _getRedisKey(ruleList) {
    return `${this.keyPrefix}:${ruleList}`;
  }

  /**
   * Returns list of Rules in Rule Group
   * @param {string} key
   * @returns Object[]
   */
  async list(key = GLOBAL_RULE_GROUP) {
    const ruleKey = this._getRedisKey(key);
    const now = Date.now();

    const pipeline = this.redis.pipeline();

    pipeline.zremrangebyscore(ruleKey, 1, now);
    pipeline.zrange(ruleKey, 0, -1, 'WITHSCORES');

    const [, raw] = handlePipelineError(await pipeline.exec());

    const rules = chunk(raw, 2)
      .map(([rule, score]) => ({
        rule: JSON.parse(rule),
        params: {
          exp: parseInt(score, 10),
        },
      }));

    return rules;
  }

  async add(key, jsonEncoded, exp = 0) {
    const pipeline = this.redis.pipeline();

    const ruleKey = this._getRedisKey(key);
    const consulKey = this._getConsulKey(key);
    const now = Date.now();

    // @TODO lua?
    pipeline.zremrangebyscore(ruleKey, 1, now);
    pipeline.zadd(ruleKey, exp, jsonEncoded);

    handlePipelineError(await pipeline.exec());

    await this.consul.kv.set({
      key: consulKey,
      value: now.toString(),
    });
  }
}

module.exports = {
  RevocationRulesManager,
  GLOBAL_RULE_GROUP,
};

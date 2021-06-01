const assert = require('assert');
const { Microfleet } = require('@microfleet/core');
const { helpers: { generateClass } } = require('common-errors');
const ld = require('lodash');

const handlePipeline = require('../pipeline-error');

const CF_IP_LIST_INFO = 'cf:available-lists';
const IP_TO_LIST = 'cf:ip-to-list';
const CF_IP_LIST_MAX = 1000;

const ListFullError = generateClass('ListFullError', { args: ['message', 'lists'] });

class CloudflareIPList {
  constructor(service, api, config) {
    assert(service instanceof Microfleet, 'ms-users instance required');
    this.service = service;
    this.redis = service.redis;
    this.cfApi = api.withAccountId(config.accountId);
    this.config = config;
  }

  async findRuleListId(ip) {
    const listId = await this.redis.hget(IP_TO_LIST, ip);
    return listId;
  }

  async touchIP(entry, list) {
    const { ip } = entry;
    assert(ip, 'invalid ip');
    return this.cfApi.createListItems(list, [entry]);
  }

  async addIP(entry) {
    const { ip } = entry;
    assert(ip, 'invalid ip');

    const freeList = await this.findFreeList();
    await this.cfApi.createListItems(freeList, [entry]);
    const pipeline = this.redis.pipeline();
    pipeline.hset(IP_TO_LIST, ip, freeList);
    pipeline.zincrby(CF_IP_LIST_INFO, 1, freeList);

    handlePipeline(await pipeline.exec());

    return freeList;
  }

  async cleanupList(listId) {
    const ipsGenerator = this.getListIPsGenerator(listId);
    const outdatedGenerator = this.findOutdatedGenerator(ipsGenerator);

    for await (const chunk of outdatedGenerator) {
      if (Array.isArray(chunk) && chunk.length > 0) {
        const ips = [];
        const ids = chunk.map(({ id, ip }) => {
          ips.push(ip);
          return id;
        });

        await this.cfApi.deleteListItems(listId, ids);
        const pipeline = this.redis.pipeline();

        pipeline.hdel(IP_TO_LIST, ...ips);
        pipeline.zincrby(CF_IP_LIST_INFO, 0 - ips.length, listId);

        handlePipeline(await pipeline.exec());
      }
    }
  }

  async resyncList(listId) {
    const ipsGenerator = this.getListIPsGenerator(listId);
    const pipeline = this.redis.pipeline();
    const tempKey = `${IP_TO_LIST}-old`;
    let ipCount = 0;

    for await (const chunk of ipsGenerator) {
      ipCount += chunk.length;
      pipeline.hmset(tempKey, ...chunk.map((ip) => [ip, listId]));
    }

    pipeline.del(IP_TO_LIST);
    pipeline.rename(tempKey, IP_TO_LIST);
    pipeline.zadd(CF_IP_LIST_INFO, ipCount, listId);

    return handlePipeline(await pipeline.exec());
  }

  async findFreeList() {
    const lists = await this.getCFLists();
    const availableList = Object.entries(lists)
      .sort(([, aItemCount], [, bItemCount]) => aItemCount - bItemCount)
      .find(([, itemCount]) => itemCount < CF_IP_LIST_MAX);

    if (!availableList) throw new ListFullError('no free list', lists);

    return availableList[0];
  }

  async* findOutdatedGenerator(ipList) {
    for await (const chunk of ipList) {
      yield chunk.filter((ip) => Date.now() - this.config.ttl > Date.parse(ip.modified_on));
    }
  }

  async* getListIPsGenerator(listId) {
    let cursor;

    while (true) {
      // eslint-disable-next-line no-await-in-loop
      const response = await this.getIPs(listId, cursor);
      const { result_info: resultInfo, result } = response;

      yield result;

      if (typeof resultInfo === 'object' && resultInfo.cursors) {
        ({ cursors: { after: cursor } } = resultInfo);
      } else {
        cursor = null;
      }

      if (!cursor) return;
    }
  }

  /** Get remote IPs */
  async getIPs(listId, cursor) {
    return this.cfApi.getListItems(listId, cursor);
  }

  /** Get Cloudflare Rule lists */
  async getCFLists() {
    const { redis } = this;
    const listInfo = await redis.zrevrangebyscore(CF_IP_LIST_INFO, '+inf', '-inf', 'WITHSCORES');

    if (listInfo.length > 0) {
      return ld.chunk(listInfo, 2).reduce((a, [list, size]) => {
        a[list] = parseInt(size, 10); return a;
      }, {});
    }

    return this.loadCfLists();
  }

  /** Download and save Clouflare Rule lists into cache */
  async loadCfLists() {
    const { prefix, listCacheTTL } = this.config;
    const { result: lists } = await this.cfApi.getLists();
    const listsObject = {};

    const pipeline = this.redis.pipeline();
    pipeline.del(CF_IP_LIST_INFO);

    lists.forEach(({ name, id, num_items: numItems }) => {
      if (!name.startsWith(prefix || '')) return;
      pipeline.zadd(CF_IP_LIST_INFO, numItems, id);
      listsObject[id] = numItems;
    });

    pipeline.expire(CF_IP_LIST_INFO, listCacheTTL);

    handlePipeline(await pipeline.exec());

    return listsObject;
  }
}

module.exports = {
  CloudflareIPList,
};

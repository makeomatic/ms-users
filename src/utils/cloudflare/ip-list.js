const assert = require('assert');
const { Microfleet } = require('@microfleet/core');
const { helpers: { generateClass } } = require('common-errors');

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

  async touchIP(ip, list) {
    return this.cfApi.createListItems(list, [ip]);
  }

  async addIP(ip) {
    const freeList = await this.findFreeLists();
    await this.cfApi.createListItems(freeList, [ip]);

    const pipeline = this.redis.pipeline();
    pipeline.hset(IP_TO_LIST, ip, freeList);
    pipeline.zincrby(CF_IP_LIST_INFO, 1, freeList);

    const result = await pipeline.exec();

    return handlePipeline(result);
  }

  async cleanupList(listId) {
    const ipsGenerator = this.getListIPsGenerator(this, listId);
    const outdatedGenerator = this.findOutdatedGenerator(this.config.ttl, ipsGenerator);

    for await (const chunk of outdatedGenerator) {
      if (Array.isArray(chunk) || chunk.length > 0) {
        await this.cfApi.deleteListItems(listId, chunk);
        await this.redis.hdel(IP_TO_LIST, ...chunk);
      }
    }
  }

  async resyncList(listId) {
    const ipsGenerator = this.getListIPsGenerator(this, listId);
    const pipeline = this.redis.pipeline();
    const tempKey = `${IP_TO_LIST}-old`;

    for await (const chunk of ipsGenerator) {
      pipeline.hmset(tempKey, ...chunk.map((ip) => [ip, listId]));
    }

    pipeline.del(IP_TO_LIST);
    pipeline.rename(tempKey, IP_TO_LIST);

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
    let done = false;
    let cursor;

    while (!done) {
      // eslint-disable-next-line no-await-in-loop
      const { result_info: { cursors: after }, result } = await this.getIPs(listId, cursor);
      if (!after) done = true;
      yield result;
    }
  }

  /** Get remote IPs */
  async getIPs(listId, cursor) {
    return this.cfApi.getListItems(listId, cursor);
  }

  /** Get Cloudflare Rule lists */
  async getCFLists() {
    const { redis } = this;
    const listInfo = await redis.zrevrangebyscore(CF_IP_LIST_INFO, 0, -1, 'WITHSCORES');

    if (listInfo.length > 0) {
      return listInfo.reduce((a, b) => {
        a[b] = ''; return a;
      }, {});
    }

    return this.loadCfLists();
  }

  /** Download and save Clouflare Rule lists into cache */
  async loadCfLists() {
    const { result: lists } = await this.cfApi.getLists();
    const listsObject = {};

    const pipeline = this.redis.pipeline();
    pipeline.del(CF_IP_LIST_INFO);

    lists.forEach(({ id, num_items: numItems }) => {
      pipeline.zadd(CF_IP_LIST_INFO, numItems, id);
      listsObject[id] = numItems;
    });

    pipeline.expire(CF_IP_LIST_INFO, this.config.listCacheTTL);

    handlePipeline(await pipeline.exec());

    return listsObject;
  }
}

module.exports = {
  CloudflareIPList,
};

const assert = require('assert');
const { Microfleet } = require('@microfleet/core');
const { helpers: { generateClass } } = require('common-errors');

const handlePipeline = require('../pipeline-error');

const IP_LIST = 'cf:pass-rate-limit';
const CF_IP_LIST_INFO = 'cf:available-lists';
const IP_TO_LIST = 'cf:ip-to-list';

const CF_IP_LIST_MAX = 10;
const delimiter = ':';

const ListFullError = generateClass('ListFullError', { args: ['message', 'lists'] });

class CloudflareIPList {
  constructor(service, config) {
    assert(service instanceof Microfleet, 'ms-users instance required');
    this.service = service;
    this.redis = service.redis;
    this.cfApi = service.cfApi.withAccountId(config.accountId);
  }

  async ipExists(ip) {
    return this.redis.hget(IP_TO_LIST, ip);
  }

  async addIP(ip) {
    const ips = Array.isArray(ip) ? ip : [ip];
    const freeList = await this.findFreeList();
    await this.cfApi.createListItems(freeList, ips);

    const pipeline = this.redis.multi();

    pipeline.zadd(IP_LIST, Date.now(), ip);
    pipeline.hset(IP_TO_LIST, ip, freeList);
    pipeline.zincrby(CF_IP_LIST_INFO, ips.length, freeList);

    const result = await pipeline.exec();

    handlePipeline(result);
  }

  async cleanupList() {
    const outdatedIps = await this.redis.zrevrangebyscore(CF_IP_LIST_INFO, '-inf', Date.now() - month);
    const byIpList = {};

    outdatedIps.forEach((record) => {
      const [ip, listId] = record.split(delimiter);
      if (!byIpList[listId]) byIpList[listId] = [];
      byIpList[listId].push(ip);
    });

    const deletePromises = Object.entries(byIpList).map(async ([listId, ips]) => {
      await this.cfApi.deleteListItems(listId, ips);
      await this.redis.zincrby(CF_IP_LIST_INFO, 0 - ips.length, listId);
    });

    // eslint-disable-next-line promise/no-native
    await Promise.allSettled(deletePromises);
  }

  async findListIds(ips) {
    const ids = await this.redis.hmget(IP_TO_LIST, ips);
    return ids;
  }

  async findFreeList() {
    const lists = await this.getCfLists();
    console.debug('lists', lists);
    const emptyList = Object.entries(lists).find(([, v]) => v < CF_IP_LIST_MAX);
    if (!emptyList) {
      throw new ListFullError('no free list', lists);
    }
    return emptyList[0];
  }

  async getCfLists() {
    const listInfo = await this.redis.zrevrangebyscore(CF_IP_LIST_INFO, 0, -1, 'WITHSCORES');
    console.debug('listInfo', { listInfo });
    if (listInfo.length > 0) {
      return listInfo.reduce((a, b) => { a[b] = ''; return a; }, {});
    }
    return this.loadCfLists();
  }

  async loadCfLists() {
    const { result: lists } = await this.cfApi.getLists();
    console.debug('got lists', lists);
    const pipeline = this.redis.pipeline();
    const listsObject = {};

    pipeline.del(CF_IP_LIST_INFO);
    lists.forEach(({ id, num_items: numItems }) => {
      console.debug('add', { id, numItems });
      pipeline.zadd(CF_IP_LIST_INFO, numItems, id);
      listsObject[id] = numItems;
    });

    pipeline.expire(CF_IP_LIST_INFO, 50000); // @TODO
    handlePipeline(await pipeline.exec());

    return listsObject;
  }
}

module.exports = {
  CloudflareIPList,
};

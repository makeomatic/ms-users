const assert = require('assert');
const { Microfleet } = require('@microfleet/core');
const Promise = require('bluebird');
const { EventEmitter, once } = require('events');

const { CloudflareClient } = require('./client');
const { CloudflareAPI } = require('./api');
const { CloudflareIPList } = require('./ip-list');

class CloudflareWorker extends EventEmitter {
  constructor(service, config) {
    assert(service instanceof Microfleet, 'ms-users instance required');

    super();

    const client = new CloudflareClient(config.auth);
    const cfApi = new CloudflareAPI(client, config.api);

    this.service = service;
    this.config = config.worker;
    this.cfList = new CloudflareIPList(service, cfApi, config.accessList);
    this.run = this.run.bind(this);
    this.start = this.start.bind(this);
  }

  start() {
    if (!this.config.enabled) return;

    this.next = setTimeout(
      this.run,
      this.config.cleanupInterval
    );
  }

  async stop() {
    if (this.working) await once('done');
    if (this.next) clearTimeout(this.next);
  }

  async run() {
    try {
      const isLeader = await this.service.whenLeader();
      if (isLeader) {
        await this.cleanup();
      }
    } catch (err) {
      this.service.log.error({ err }, 'Cleanup error');
    } finally {
      this.start();
    }
  }

  async cleanup() {
    try {
      const lists = await this.cfList.loadCfLists();
      this.working = true;

      await Promise.map(
        Object.keys(lists),
        (list) => this.cfList.cleanupList(list),
        { concurrency: this.config.concurrency }
      );
    } catch (err) {
      this.emit('error', err);
      throw err;
    } finally {
      this.working = false;
      this.emit('done');
    }
  }
}

module.exports = {
  CloudflareWorker,
};

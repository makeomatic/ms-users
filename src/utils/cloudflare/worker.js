const assert = require('assert');
const { Microfleet } = require('@microfleet/core');
const Promise = require('bluebird');
const { EventEmitter, once } = require('events');

const { CloudflareClient } = require('./client');
const { CloudflareAPI } = require('./api');
const { CloudflareIPList } = require('./ip-list');

class CloudflareWorker extends EventEmitter {
  constructor(service) {
    assert(service instanceof Microfleet, 'ms-users instance required');

    super();

    const config = service.config.cfList;
    const client = new CloudflareClient(config.auth);
    const cfApi = new CloudflareAPI(client);

    this.service = service;
    this.config = config.worker;
    this.cfList = new CloudflareIPList(service, cfApi, config.accessList);
    this.cleanup = this.cleanup.bind(this);
  }

  start() {
    if (!this.config.enabled) return;

    this.next = setTimeout(
      this.config.cleanupInterval,
      this.cleanup
    );
  }

  async stop() {
    if (this.working) await once('done');
    if (this.next) clearTimeout(this.next);
  }

  async cleanup() {
    // @TODO this should be locked and executed only bby one instance
    try {
      const lists = this.cfList.getCFLists();
      this.working = true;
      await Promise.map(
        lists,
        (list) => this.cfList.cleanupList(list),
        { concurrency: this.config.concurrency }
      );
    } catch (err) {
      this.service.log.error({ err }, 'CF cleanup error');
      this.emit('error', err);
    } finally {
      this.working = false;
      this.emit('done');
      this.start(); // schedule next execution
    }
  }
}

module.exports = {
  CloudflareWorker,
};

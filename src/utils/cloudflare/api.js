const assert = require('assert');
const retry = require('promise-retry');

const { CloudflareClient } = require('./client');

const RULE_LIST = 'accounts/:accountId/rules/lists';
const RULE_ITEM_LIST = 'accounts/:accountId/rules/lists/:listId/items';
const RULE_BATCH_PROGESS = 'accounts/:accountId/rules/lists/bulk_operations/:operationId';

class CloudflareAPI {
  constructor(cfClient, withProps = {}) {
    assert(cfClient instanceof CloudflareClient, 'invalid client');

    this.cfClient = cfClient;
    this.client = cfClient.client;
    this.props = withProps;
  }

  withAccountId(accountId) {
    return new CloudflareAPI(this.cfClient, { accountId });
  }

  apiUrl(t, values) {
    const { accountId } = this.props;
    assert(accountId, 'accountId invalid');
    return Object.entries({ accountId, ...values })
      .reduce((prev, [prop, val]) => prev.replace(`:${prop}`, val), t);
  }

  async getAccounts() {
    return this.client.get('accounts');
  }

  async getLists() {
    const { accountId } = this.props;
    return this.client.get(this.apiUrl(RULE_LIST, { accountId }));
  }

  async createList(name, kind = 'ip', description = '') {
    const { accountId } = this.props;
    const url = this.apiUrl(RULE_LIST, { accountId });
    const { result } = await this.client.post(url, {
      json: { name, kind, description },
    });
    return result;
  }

  async updateList(name, kind, description = '') {
    const { accountId } = this.props;
    const url = this.apiUrl(RULE_LIST, { accountId });

    return this.client.put(url, {
      name, kind, description,
    });
  }

  async getListItems(listId, cursor) {
    const { accountId } = this.props;
    const url = this.apiUrl(RULE_ITEM_LIST, { accountId, listId });
    return this.client.get(url, { searchParams: { cursor } });
  }

  async waitListOperation(operationId) {
    const { accountId } = this.props;
    const url = this.apiUrl(RULE_BATCH_PROGESS, { accountId, operationId });

    // https://api.cloudflare.com/#rules-lists-get-bulk-operation
    await retry(async (retryFn) => {
      try {
        return this.client.get(url);
      } catch (e) {
        retryFn(e);
      }
      return null;
    }, { retries: 10 });
  }

  async createListItems(listId, items) {
    assert(Array.isArray(items) && items.length > 0, 'should provide array of items');

    const { accountId } = this.props;
    const url = this.apiUrl(RULE_ITEM_LIST, { accountId, listId });
    const toCreate = items.map((ip) => ({ ip }));

    const { result: { operation_id: operationId } } = await this.client
      .post(url, { json: toCreate });

    const operationResult = await this.waitListOperation(operationId);

    return operationResult;
  }

  async deleteListItems(listId, items) {
    assert(Array.isArray(items) && items.length > 0, 'should provide array of items');

    const { accountId } = this.props;
    const url = this.apiUrl(RULE_ITEM_LIST, { accountId, listId });
    const toDelete = items.map((id) => ({ id }));

    const { result: { operation_id: operationId } } = await this.client
      .delete(url, { json: toDelete });

    const operationResult = await this.waitListOperation(operationId);
    return operationResult;
  }
}

module.exports = {
  CloudflareAPI,
};

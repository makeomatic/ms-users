const assert = require('assert');
const retry = require('promise-retry');

const { CF_ERROR } = require('./client');

class CloudflareAPI {
  constructor(cfClient, withProps) {
    this.cfClient = cfClient;
    this.client = cfClient.client;
    this.props = withProps;
  }

  withAccountId(accountId) {
    return new CloudflareAPI(this.cfClient, { accountId });
  }

  async getAccounts() {
    return this.client.get('accounts');
  }

  async getLists() {
    const { accountId } = this.props;
    return this.client.get(`accounts/${accountId}/rules/lists`);
  }

  async createList(name, kind = 'ip', description = '') {
    const { accountId } = this.props;
    const { result } = await this.client.post(`accounts/${accountId}/rules/lists`, {
      json: { name, kind, description },
    });
    return result;
  }

  async updateList(name, kind, description = '') {
    const { accountId } = this.props;
    return this.client.put(`accounts/${accountId}/rules/lists`, {
      name, kind, description,
    });
  }

  async getListItems(listId, cursor) {
    const { accountId } = this.props;
    return this.client.get(`accounts/${accountId}/rules/lists/${listId}/items`, { searchParams: { cursor } });
  }

  async waitListOperation(operationId) {
    const { accountId } = this.props;

    // https://api.cloudflare.com/#rules-lists-get-bulk-operation
    await retry(async (retryFn) => {
      try {
        const result = await this.client.get(`accounts/${accountId}/rules/lists/bulk_operations/${operationId}`);
        if (result.error) {
          throw new CF_ERROR(result.message, result.error);
        }
        return result;
      } catch (e) {
        retryFn(e);
      }
      return null;
    }, { retries: 10 });
  }

  async createListItems(listId, items) {
    assert(Array.isArray(items) && items.length > 0, 'should provide array of items');

    const { accountId } = this.props;
    const toCreate = items.map((ip) => ({ ip }));

    const { result: { operation_id: operationId } } = await this.client
      .post(`accounts/${accountId}/rules/lists/${listId}/items`, { json: toCreate });

    const operationResult = await this.waitListOperation(operationId);

    return operationResult;
  }

  async deleteListItems(listId, items) {
    assert(Array.isArray(items) && items.length > 0, 'should provide array of items');

    const { accountId } = this.props;
    const toDelete = items.map((id) => ({ id }));

    const { result: { operation_id: operationId } } = await this.client
      .delete(`accounts/${accountId}/rules/lists/${listId}/items`, { json: toDelete });

    const operationResult = await this.waitListOperation(operationId);
    return operationResult;
  }
}

module.exports = {
  CloudflareAPI,
};

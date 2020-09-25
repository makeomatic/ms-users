const assert = require('assert');
const pRetry = require('p-retry');
const { helpers: { generateClass } } = require('common-errors');

const assertStringNotEmpty = require('../asserts/string-not-empty');

const BulkOperationError = generateClass('BulkOperationError', {
  args: ['message', 'response'],
});

const assertValidAccountId = (accountId) => assertStringNotEmpty(accountId, 'should be valid accountId');

const ruleListUrl = ({ accountId }) => {
  assertValidAccountId(accountId);
  return `accounts/${accountId}/rules/lists`;
};

const ruleItemListUrl = ({ accountId, listId }) => {
  assertValidAccountId(accountId);
  assertStringNotEmpty(listId, 'should be valid listId');
  return `accounts/${accountId}/rules/lists/${listId}/items`;
};

const ruleListBatchProgressUrl = ({ accountId, operationId }) => {
  assertValidAccountId(accountId);
  assertStringNotEmpty(operationId, 'should be valid operationId');
  return `accounts/${accountId}/rules/lists/bulk_operations/${operationId}`;
};

const defaultRetryConfig = {
  retries: 10,
  factor: 0.5,
};

class CloudflareAPI {
  constructor(cfClient, config = {}, withProps = {}) {
    assert(cfClient, 'CloudflareClient required');
    this.config = config;
    this.cfClient = cfClient;
    this.http = cfClient.getHttpClient();
    this.props = withProps;
  }

  withAccountId(accountId) {
    return new CloudflareAPI(this.cfClient, this.config, { accountId });
  }

  async createList(name, kind = 'ip', description = '') {
    const { accountId } = this.props;
    const url = ruleListUrl({ accountId });
    const { result } = await this.http.post(url, {
      json: { name, kind, description },
    });
    return result;
  }

  async getLists() {
    const { accountId } = this.props;
    return this.http.get(ruleListUrl({ accountId }));
  }

  async getListItems(listId, cursor) {
    const { accountId } = this.props;
    const url = ruleItemListUrl({ accountId, listId });
    return this.http.get(url, { searchParams: { cursor } });
  }

  async waitListOperation(operationId) {
    const { accountId } = this.props;
    const url = ruleListBatchProgressUrl({ accountId, operationId });

    // https://api.cloudflare.com/#rules-lists-get-bulk-operation
    return pRetry(
      async () => {
        try {
          const response = await this.http.get(url);
          const { result: { status, error } } = response;
          if (status === 'failed') {
            throw new BulkOperationError(error, response);
          }
          return response;
        } catch (e) {
          if (e instanceof BulkOperationError) {
            throw new pRetry.AbortError(e);
          }
          throw e;
        }
      },
      { ...defaultRetryConfig, ...this.config.retry }
    );
  }

  async createListItems(listId, items) {
    assert(Array.isArray(items) && items.length > 0, 'should provide array of items');

    const { accountId } = this.props;
    const url = ruleItemListUrl({ accountId, listId });

    const { result: { operation_id: operationId } } = await this.http
      .post(url, { json: items });

    return this.waitListOperation(operationId);
  }

  async deleteListItems(listId, items) {
    assert(Array.isArray(items) && items.length > 0, 'should provide array of items');

    const { accountId } = this.props;
    const url = ruleItemListUrl({ accountId, listId });
    const toDelete = items.map((id) => ({ id }));

    const { result: { operation_id: operationId } } = await this.http
      .delete(url, { json: { items: toDelete } });

    return this.waitListOperation(operationId);
  }
}

module.exports = {
  CloudflareAPI,
};

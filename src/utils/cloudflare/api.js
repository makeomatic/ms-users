const { strict: assert } = require('assert');
const pRetry = require('p-retry');
const { helpers: { generateClass } } = require('common-errors');

const assertStringNotEmpty = require('../asserts/string-not-empty');
const { CloudflareAPIError } = require('./error');

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

function processResponse(response) {
  if (response.success === false) {
    throw new CloudflareAPIError(response.messages, response.errors);
  }
  return response;
}

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
    const response = await this.http.post(url, {
      json: { name, kind, description },
    });
    return processResponse(response).result;
  }

  async getLists() {
    const { accountId } = this.props;
    const response = await this.http.get(ruleListUrl({ accountId }));
    return processResponse(response);
  }

  async getListItems(listId, cursor) {
    const { accountId } = this.props;
    const url = ruleItemListUrl({ accountId, listId });
    const response = this.http.get(url, { searchParams: { cursor } });
    return processResponse(response);
  }

  async waitListOperation(operationId) {
    const { accountId } = this.props;
    const url = ruleListBatchProgressUrl({ accountId, operationId });

    // https://api.cloudflare.com/#rules-lists-get-bulk-operation
    return pRetry(
      async () => {
        try {
          const response = await this.http.get(url);
          const { result: { status, error } } = processResponse(response);

          if (status === 'failed') {
            throw new BulkOperationError(error, response);
          }

          if (status === 'pending') {
            throw new Error('Opearation pending');
          }

          return response;
        } catch (e) {
          if (e instanceof BulkOperationError || e instanceof CloudflareAPIError) {
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
    const response = await this.http.post(url, { json: items });

    const { result: { operation_id: operationId } } = processResponse(response);

    return this.waitListOperation(operationId);
  }

  async deleteListItems(listId, items) {
    assert(Array.isArray(items) && items.length > 0, 'should provide array of items');

    const { accountId } = this.props;
    const url = ruleItemListUrl({ accountId, listId });
    const toDelete = items.map((id) => ({ id }));

    const response = await this.http.delete(url, { json: { items: toDelete } });
    const { result: { operation_id: operationId } } = processResponse(response);

    return this.waitListOperation(operationId);
  }
}

module.exports = {
  CloudflareAPI,
};

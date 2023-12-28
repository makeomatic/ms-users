const assert = require('node:assert/strict');
const { defaultsDeep } = require('lodash');
const nock = require('nock');
const url = require('url');
const qs = require('qs');

const { CloudflareAPI } = require('../../../src/utils/cloudflare/api');
const { CloudflareClient } = require('../../../src/utils/cloudflare/client');
const { CloudflareIPList } = require('../../../src/utils/cloudflare/ip-list');

function createCfList(service, config = {}) {
  const defaultConfig = {
    auth: {
      token: 'validtoken123',
    },
    accessList: {
      ttl: 1000,
      listCacheTTL: 10000,
      accountId: 'validaccountid',
    },
  };
  const mergedConfig = defaultsDeep(defaultConfig, config);

  const client = new CloudflareClient(mergedConfig.auth);
  const api = new CloudflareAPI(client);
  const list = new CloudflareIPList(service, api, mergedConfig.accessList);

  return list;
}

function restoreCfApi() {
  nock.cleanAll();
  nock.restore();
}

/**
 * See https://api.cloudflare.com/
 */
function nockCfApi() {
  const idPattern = '([a-z0-9_-]*)';
  const rulesListUrl = new RegExp(`accounts/${idPattern}/rules/lists$`);
  const rulesListItemsUrl = new RegExp(`accounts/${idPattern}/rules/lists/${idPattern}/items$`);
  const bulkOperationStatusUrl = new RegExp(`accounts/${idPattern}/rules/lists/bulk_operations/${idPattern}$`);

  const storage = {
    lists: {},
    listIps: {},
    operations: {},
  };

  const ipEntry = ({ ip, comment }) => ({
    id: `ip${ip.replace(/\./gi, '-')}`,
    comment,
    ip,
    created_on: (new Date()).toISOString(),
    modified_on: (new Date()).toISOString(),
  });

  function createResponse(code, result) {
    const defaultResult = { success: true, result: null, errors: [], messages: [] };
    return [code, { ...defaultResult, ...result }];
  }

  function createList(_, body) {
    const { name, kind = 'ip' } = body;
    const newList = {
      id: `list-${name}`,
      num_items: 0,
      kind,
      name,
    };

    storage.lists[newList.id] = newList;

    return [200, {
      success: true,
      result: newList,
    }];
  }

  function getLists() {
    return [200, {
      result: Object.values(storage.lists),
    }];
  }

  function createListItems(reqUrl, ips) {
    const match = rulesListItemsUrl.exec(reqUrl);
    const [,, listId] = match;
    const list = storage.lists[listId];
    assert.ok(list, `should create list '${listId}' first`);

    const [, requestedOperationStatus] = list.name.match(/^test_(.+)_bulk/) || [];
    const operationId = requestedOperationStatus || 'randomoperationid';

    if (!storage.listIps[listId]) storage.listIps[listId] = [];
    const ipList = storage.listIps[listId];

    ips.forEach((ip) => {
      const ipInList = ipList.find((record) => record.ip === ip);

      if (ipInList) {
        ipInList.modified_on = (new Date()).toISOString();
        return;
      }

      ipList.push(ipEntry(ip));

      list.num_items += 1;
    });

    return [200, {
      success: true,
      errors: [],
      messages: [],
      result: {
        operation_id: operationId,
      },
    }];
  }

  function getListItems(reqUrl) {
    const perPage = 2;
    const parsedUrl = url.parse(reqUrl);
    const [,, listId] = rulesListItemsUrl.exec(parsedUrl.pathname);
    const { cursor = 0 } = qs.parse(parsedUrl.query);
    const intCursor = parseInt(cursor, 10);

    if (Object.prototype.hasOwnProperty.call(storage.lists, listId)) {
      const list = storage.listIps[listId] || [];

      const shouldPaginate = list.length > perPage && intCursor * perPage < list.length;
      const resultInfo = shouldPaginate ? { cursors: { after: intCursor + 1 } } : {};

      const start = intCursor * perPage;
      const result = {
        success: true,
        result: list.slice(start, start + perPage),
        result_info: resultInfo,
      };

      return [200, result];
    }

    throw new Error(`Unknown list '${listId}'`);
  }

  function deleteListItems(reqUrl, { items }) {
    const [,, listId] = rulesListItemsUrl.exec(reqUrl);
    const list = storage.lists[listId];
    const listIps = storage.listIps[listId];

    assert.ok(list, `should create list '${listId}' first`);

    const toDelete = items.map(({ id }) => id);
    storage.listIps[listId] = listIps.filter(({ id }) => !toDelete.includes(id));
    list.num_items = storage.listIps[listId].length;

    return [200, {
      success: true,
      errors: [],
      messages: [],
      result: {
        operation_id: 'random-delete-operation-id',
      },
    }];
  }

  function operationProgress(reqUrl) {
    const [,, id] = bulkOperationStatusUrl.exec(reqUrl);

    if (!storage.operations[`failedOnce-${id}`] && id.startsWith('retry')) {
      storage.operations[`failedOnce-${id}`] = true;
      return [404, 'Simulated Not Found error'];
    }

    if (id.startsWith('successfalse')) {
      return [200, {
        success: false,
        errors: [{ code: 1003, message: 'Invalid something' }],
        messages: [],
        result: null,
      }];
    }

    const baseResult = { id, completed: (new Date()).toISOString() };

    if (!storage.operations[`pendingOnce-${id}`] && id.startsWith('pending')) {
      storage.operations[`pendingOnce-${id}`] = true;
      return createResponse(200, { result: { status: 'pending', ...baseResult } });
    }

    if (id.startsWith('fail')) {
      return createResponse(200, { result: { status: 'failed', error: 'Simulated error', ...baseResult } });
    }

    return createResponse(200, { result: { status: 'completed', ...baseResult } });
  }

  if (!nock.isActive()) nock.activate();

  const scope = nock('https://api.cloudflare.com/client/v4')
    .persist()
    .post(rulesListUrl).reply(createList)
    .get(rulesListUrl).reply(getLists)
    .post(rulesListItemsUrl).reply(createListItems)
    .delete(rulesListItemsUrl).reply(deleteListItems)
    .get(rulesListItemsUrl).query(true).reply(getListItems)
    .get(bulkOperationStatusUrl).reply(operationProgress);

  return { scope, storage };
}

module.exports = {
  createCfList,
  nockCfApi,
  restoreCfApi,
};

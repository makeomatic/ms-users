const redisKey = require('../key');
const extractUserId = require('./extract-user-id');
const { containsKeyExpr } = require('./expressions');
const buildFilterQuery = require('./build-filter-query');

async function redisAggregateQuery(indexMeta, context) {
  const {
    service,
    redis,
    args: request,
    filter = {},
    audience,
    offset,
    limit,
  } = context;

  const { keyPrefix } = service.config.redis.options;

  const { indexName, filterKey, multiWords } = indexMeta;

  const args = ['FT.AGGREGATE', indexName];

  const [query, params] = buildFilterQuery(filter, multiWords);

  if (query.length > 0) {
    args.push(query.join(' '));
  } else {
    args.push('*');
  }

  const load = ['@id', '@__key']; // TODO field from config
  args.push('LOAD', load.length, ...load);

  const filterCondition = redisKey('', filterKey, audience); // with leading separator
  args.push('FILTER', containsKeyExpr(filterCondition));

  // TODO extract to redis aearch utils
  if (params.length > 0) {
    args.push('PARAMS', params.length, ...params);
    args.push('DIALECT', '2'); // use params dialect
  }

  // sort the response
  if (request.criteria) {
    args.push('SORTBY', request.criteria, request.order);
  }
  // limits
  args.push('LIMIT', offset, limit);

  service.log.info('redis aggregate query: %s', args.join(' '));

  const [total, ...keys] = await redis.call(...args);

  const extractId = extractUserId(keyPrefix);
  const ids = keys.map(([, key]) => extractId(key));

  return { total, ids };
}

module.exports = redisAggregateQuery;

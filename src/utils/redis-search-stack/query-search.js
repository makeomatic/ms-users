const buildFilterQuery = require('./build-filter-query');

const extractUserId = (keyPrefix) => (userKey) => userKey.split('!')[0].slice(keyPrefix.length);

async function redisSearchQuery(indexMeta, context) {
  const {
    service,
    redis,
    args: sort,
    filter = {},
    offset,
    limit,
  } = context;

  const { keyPrefix } = service.config.redis.options;
  const { indexName, multiWords } = indexMeta;

  const [criteria, order = 'ASC'] = sort;

  const args = ['FT.SEARCH', indexName];

  const [query, params] = buildFilterQuery(filter, multiWords);

  if (query.length > 0) {
    args.push(query.join(' '));
  } else {
    args.push('*');
  }

  // TODO extract to redis aearch utils
  if (params.length > 0) {
    args.push('PARAMS', params.length, ...params);
    args.push('DIALECT', '2'); // use params dialect
  }

  // sort the response
  if (criteria) {
    args.push('SORTBY', criteria, order);
  }
  // limits
  args.push('LIMIT', offset, limit);

  // we'll fetch the data later
  args.push('NOCONTENT');

  // [total, [ids]]
  service.log.info('redis search query: %s', args.join(' '));

  const [total, ...keys] = await redis.call(...args);

  const extractId = extractUserId(keyPrefix);

  const ids = keys.map(extractId);

  return { total, ids };
}

module.exports = redisSearchQuery;

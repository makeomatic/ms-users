const ensureSearchIndexes = require('./ensure-indexes');
const normalizeIndexName = require('./normalize-index-name');

const redisSearchQuery = require('./query-search');
const redisAggregateQuery = require('./query-aggregate');

module.exports = {
  ensureSearchIndexes,
  normalizeIndexName,
  redisSearchQuery,
  redisAggregateQuery,
};

const ensureSearchIndexes = require('./ensure-indexes');
const normalizeFilterProp = require('./normalize-filter-prop');
const normalizeIndexName = require('./normalize-index-name');
const buildSearchQuery = require('./build-search-query');

module.exports = {
  ensureSearchIndexes,
  normalizeFilterProp,
  normalizeIndexName,
  buildSearchQuery,
};

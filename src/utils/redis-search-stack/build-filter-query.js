const buildSearchQuery = require('./build-search-query');
const normalizeFilterProp = require('./normalize-filter-prop');

function buildFilterQuery(filter, multiWords) {
  const query = [];
  const params = [];

  for (const [propName, actionTypeOrValue] of Object.entries(filter)) {
    const prop = normalizeFilterProp(propName, actionTypeOrValue);

    if (actionTypeOrValue !== undefined) {
      const [sQuery, sParams] = buildSearchQuery(prop, actionTypeOrValue, { multiWords });

      query.push(sQuery);
      params.push(...sParams); // name, value
    }
  }

  return [query, params];
}

module.exports = buildFilterQuery;

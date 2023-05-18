const buildSearchQuery = require('./build-search-query');
const normalizeFilterProp = require('./normalize-filter-prop');
const { namedField } = require('./expressions');

function buildFilterQuery(filter, multiWords, fieldTypes) {
  const query = [];
  const params = [];

  for (const [propName, actionTypeOrValue] of Object.entries(filter)) {
    const prop = normalizeFilterProp(propName, actionTypeOrValue);

    if (actionTypeOrValue !== undefined) {
      const field = namedField(prop);
      const [sQuery, sParams] = buildSearchQuery({
        prop,
        field,
        valueOrExpr: actionTypeOrValue,
        options: { multiWords, fieldTypes },
        paramPrefix: '',
      });

      query.push(sQuery);
      params.push(...sParams); // name, value
    }
  }

  return [query, params];
}

module.exports = buildFilterQuery;

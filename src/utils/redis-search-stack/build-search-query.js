const { flatten } = require('lodash');
const {
  expression,
  numericRange,
  paramRef,
  namedField,
  tag,
  negative,
  tokensMatch,
  tokenize,
  quotedString,
} = require('./expressions');
const { FT_TYPE_TAG } = require('./extract-field-definitions');

const EMPTY_VALUE = typeof null; // NOTE Using "" occures the parser error
const FIELD_PREFIX = 'f';

const ParamSuffix = {
  eq: 'eq',
  ne: 'ne',
  match: 'm',
  any: 'any',
};

const buildParamName = (...args) => args.join('_');
const normalizePropName = (prop) => prop.replace(/\|/g, '_');

const buildStringQuery = (field, propName, paramPrefix, value) => {
  const pName = buildParamName(FIELD_PREFIX, paramPrefix, propName);
  const query = expression(field, paramRef(pName));

  const params = [pName, value];

  return {
    query, params,
  };
};

const PARTIAL_MATCH_PARAMS_OPTIONS = {
  partialMatch: true,
  suffix: ParamSuffix.match,
};

const buildTokensQuery = ({ partialMatch = false, suffix = '' } = {}) => (field, propName, paramPrefix, value) => {
  const tokens = tokenize(value);

  const params = [];
  const paramRefs = [];
  const args = suffix.length ? [FIELD_PREFIX, normalizePropName(propName), suffix] : [FIELD_PREFIX, propName];

  for (const [idx, token] of tokens.entries()) {
    const pName = buildParamName(...args, paramPrefix, String(idx + 1));
    const tokenParams = [pName, token];

    paramRefs.push(paramRef(pName));
    params.push(tokenParams);
  }

  const query = expression(field, tokensMatch(paramRefs, partialMatch));

  return {
    query,
    params: flatten(params),
  };
};

const buildMultiTokenMatch = (field, prop, paramPrefix, value) => buildTokensQuery(PARTIAL_MATCH_PARAMS_OPTIONS)(field, prop, paramPrefix, value);

const useTokens = (multiWords, propName) => {
  const props = propName.split('|');

  if (props.length > 1) { // #multi case
    return props.some((x) => multiWords.includes(x));
  }

  return multiWords.includes(propName);
};

const operator = {
  gte: (_, field, expr) => ({
    query: expression(field, numericRange(expr.gte, expr.lte)),
  }),
  lte: (_, field, expr) => ({
    query: expression(field, numericRange(expr.gte, expr.lte)),
  }),
  exists: (_, field) => ({
    query: negative(expression((field), EMPTY_VALUE)),
  }),
  isempty: (_, field) => ({
    query: expression((field), EMPTY_VALUE),
  }),
  eq: (prop, field, expr, paramPrefix) => {
    const name = buildParamName(FIELD_PREFIX, paramPrefix, prop, ParamSuffix.eq);

    return {
      query: expression(field, tag(paramRef(name))),
      params: [name, expr.eq],
    };
  },
  ne: (prop, field, expr, paramPrefix) => {
    const name = buildParamName(FIELD_PREFIX, paramPrefix, prop, ParamSuffix.ne);
    return {
      query: negative(expression(field, tag(paramRef(name)))),
      params: [name, expr.ne],
    };
  },
  match: (prop, field, expr, paramPrefix, options) => {
    const propName = normalizePropName(prop);
    const name = buildParamName(FIELD_PREFIX, propName, paramPrefix, ParamSuffix.match);

    const { match } = expr;

    if (useTokens(options.multiWords, prop)) {
      const tokenMatch = buildMultiTokenMatch(field, propName, paramPrefix, match);

      return tokenMatch;
    }

    const params = paramRef(name);

    return {
      query: expression(field, tokensMatch(params, true)),
      params: [name, match],
    };
  },
  any: (prop, __field, expr, paramPrefix, options) => {
    const subExpressions = expr.any.map((valueOrExpr, index) => {
      const field = namedField(prop);

      // eslint-disable-next-line no-use-before-define
      return buildSearchQuery({
        prop,
        paramPrefix: `${paramPrefix}any_${index}`,
        field,
        valueOrExpr,
        options,
      });
    });

    const mergedQueries = subExpressions.map(([query]) => ` (${query}) `).join('|');

    return {
      query: `(${mergedQueries})`,
      params: flatten(subExpressions.map(([, params]) => params)),
    };
  },
};

const queryForString = (params) => {
  const { prop, field, paramPrefix, valueOrExpr, options } = params;

  const { multiWords = [] } = options;
  const isMultiWords = useTokens(multiWords, params.prop);

  // Split by tokens if multiwords includes the field
  if (isMultiWords) {
    const tokenQuery = buildTokensQuery();

    return tokenQuery(field, prop, paramPrefix, valueOrExpr);
  }

  if (options.fieldTypes[params.prop] === FT_TYPE_TAG) {
    const pName = buildParamName(FIELD_PREFIX, paramPrefix, prop);

    return {
      query: expression(field, tag(paramRef(pName))),
      params: [pName, quotedString(valueOrExpr)],
    };
  }

  return buildStringQuery(field, prop, paramPrefix, valueOrExpr);
};

const buildSearchQuery = (buildParams) => {
  const { prop, valueOrExpr, field, options, paramPrefix } = buildParams;
  // Process simple value

  if (typeof buildParams.valueOrExpr === 'string') {
    const q4str = queryForString(buildParams);
    const { query, params = [] } = q4str;

    return [query, params];
  }

  // Omit 'fields' prop from  #multi statement if exists
  const { fields, ...expr } = valueOrExpr;

  // Process expression with action & value
  const action = Object.keys(expr)[0];

  const buildQuery = operator[action];

  if (buildQuery === undefined) {
    throw Error(`Not supported operation: ${valueOrExpr}`);
  }

  const { query, params = [] } = buildQuery(prop, field, valueOrExpr, paramPrefix, options);

  return [query, params];
};

module.exports = buildSearchQuery;

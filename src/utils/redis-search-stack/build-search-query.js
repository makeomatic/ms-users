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
} = require('./expressions');

const EMPTY_VALUE = typeof null; // NOTE Using "" occures the parser error
const FIELD_PREFIX = 'f';

const ParamSuffix = {
  eq: 'eq',
  ne: 'ne',
  match: 'm',
};

const buildParamName = (...args) => args.join('_');
const normalizePropName = (prop) => prop.replace(/\|/g, '_');

const buildStringQuery = (field, propName, value) => {
  const pName = buildParamName(FIELD_PREFIX, propName);
  const query = expression(field, paramRef(pName));

  const params = [pName, value];
  return [query, params];
};

const buildTokensQuery = ({ partialMatch = false, suffix = '' } = {}) => (field, propName, value) => {
  const tokens = tokenize(value);

  const params = [];
  const paramRefs = [];
  const args = suffix.length ? [FIELD_PREFIX, propName, suffix] : [FIELD_PREFIX, propName];

  for (const [idx, token] of tokens.entries()) {
    const pName = buildParamName(...args, String(idx + 1));
    const tokenParams = [pName, token];

    paramRefs.push(paramRef(pName));
    params.push(tokenParams);
  }

  const query = expression(field, tokensMatch(paramRefs, partialMatch));

  return [query, flatten(params)];
};

const buildMultiTokenMatch = (field, prop, value) => {
  const options = {
    partialMatch: true,
    suffix: ParamSuffix.match,
  };

  return buildTokensQuery(options)(field, prop, value);
};

const searchQueryBuilder = {
  // (prop, field, expr)
  gte: (_, field, expr) => expression(field, numericRange(expr.gte, expr.lte)),
  lte: (_, field, expr) => expression(field, numericRange(expr.gte, expr.lte)),
  exists: (_, field) => negative(expression((field), EMPTY_VALUE)),
  isempty: (_, field) => expression((field), EMPTY_VALUE),
  eq: (prop, field) => {
    const name = buildParamName(FIELD_PREFIX, prop, ParamSuffix.eq);
    return expression(field, tag(paramRef(name)));
  },
  ne: (prop, field) => {
    const name = buildParamName(FIELD_PREFIX, prop, ParamSuffix.ne);
    return negative(expression(field, tag(paramRef(name))));
  },
  match: (prop, field) => {
    const propName = normalizePropName(prop);

    const name = buildParamName(FIELD_PREFIX, propName, ParamSuffix.match);
    const params = paramRef(name);

    return expression(field, tokensMatch(params));
  },
};

const searchParamBuilder = {
  // (prop, expr)
  eq: (prop, expr) => {
    const name = buildParamName(FIELD_PREFIX, prop, ParamSuffix.eq);
    return [name, expr.eq];
  },
  ne: (prop, expr) => {
    const name = buildParamName(FIELD_PREFIX, prop, ParamSuffix.ne);
    return [name, expr.ne];
  },
  match: (prop, expr) => {
    const propName = normalizePropName(prop);
    const name = buildParamName(FIELD_PREFIX, propName, ParamSuffix.match);
    return [name, expr.match];
  },
};

const buildSearchQuery = (propName, valueOrExpr, options) => {
  const { multiWords = [] } = options;

  const field = namedField(propName);

  // Split by tokens if multiwords includes the field

  const isMultiWords = multiWords.includes(propName);

  // Process simple value
  if (typeof valueOrExpr === 'string') {
    if (isMultiWords) {
      const tokenQuery = buildTokensQuery();

      return tokenQuery(field, propName, valueOrExpr);
    }

    return buildStringQuery(field, propName, valueOrExpr);
  }

  // Omit 'fields' prop from  #multi statement if exists
  const { fields, ...expr } = valueOrExpr;

  // Process expression with action & value
  const action = Object.keys(expr)[0];

  if (isMultiWords && action === 'match') {
    return buildMultiTokenMatch(field, propName, valueOrExpr.match);
  }

  const buildQuery = searchQueryBuilder[action];
  const buildParams = searchParamBuilder[action];

  if (buildQuery === undefined) {
    throw Error(`Not supported operation: ${valueOrExpr}`);
  }

  const query = buildQuery(propName, field, valueOrExpr);
  const params = (buildParams !== undefined) ? buildParams(propName, valueOrExpr) : [];

  return [query, params];
};

module.exports = buildSearchQuery;

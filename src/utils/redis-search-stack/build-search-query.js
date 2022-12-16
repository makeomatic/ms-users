const { flatten } = require('lodash');
const {
  expression,
  numericRange,
  paramRef,
  namedField,
  tag,
  negative,
  partialMatch,
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

const tokenParamNameBuilder = (prop, index) => buildParamName(FIELD_PREFIX, prop, String(index + 1));
const tokenQueryBuilder = (field, pName) => expression(field, paramRef(pName));

const buildTokensQuery = (paramBuilder, queryBuilder) => (field, prop, tokens) => {
  const params = [];
  const query = [];

  for (const [idx, token] of tokens.entries()) {
    const pName = paramBuilder(prop, idx);
    const tokenQuery = queryBuilder(field, pName);

    const tokenParams = [pName, token];

    query.push(tokenQuery);
    params.push(tokenParams);
  }

  return [query.join(' '), flatten(params)];
};

const buildMultiWord = (field, propName, value) => {
  const tokens = tokenize(value);

  const builder = buildTokensQuery(tokenParamNameBuilder, tokenQueryBuilder);

  return builder(field, propName, tokens);
};

const searchQueryBuilder = {
  // (prop, field, expr, isMultiWords)
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
  match: (prop, field, _, isMultiWords) => {
    const propName = normalizePropName(prop);

    if (isMultiWords) {
      // TODO
    }

    const name = buildParamName(FIELD_PREFIX, propName, ParamSuffix.match);
    return expression(field, partialMatch(paramRef(name)));
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
      return buildMultiWord(field, propName, valueOrExpr);
    }

    return buildStringQuery(field, propName, valueOrExpr);
  }

  // Omit 'fields' prop from  #multi statement if exists
  const { fields, ...expr } = valueOrExpr;

  // Process expression with action & value
  const action = Object.keys(expr)[0];

  const buildQuery = searchQueryBuilder[action];
  const buildParams = searchParamBuilder[action];

  if (buildQuery === undefined) {
    throw Error(`Not supported operation: ${valueOrExpr}`);
  }

  const query = buildQuery(propName, field, valueOrExpr, isMultiWords);
  const params = (buildParams !== undefined) ? buildParams(propName, valueOrExpr, isMultiWords) : [];

  return [query, params];
};

module.exports = buildSearchQuery;

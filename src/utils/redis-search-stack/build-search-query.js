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

const buildStringQuery = (field, propName, value) => {
  const pName = buildParamName(FIELD_PREFIX, propName);
  const query = expression(field, paramRef(pName));

  const params = [pName, value];
  return [query, params];
};

const PARTIAL_MATCH_PARAMS_OPTIONS = {
  partialMatch: true,
  suffix: ParamSuffix.match,
};

const buildTokensQuery = ({ partialMatch = false, suffix = '' } = {}) => (field, propName, value) => {
  const tokens = tokenize(value);

  const params = [];
  const paramRefs = [];
  const args = suffix.length ? [FIELD_PREFIX, normalizePropName(propName), suffix] : [FIELD_PREFIX, propName];

  for (const [idx, token] of tokens.entries()) {
    const pName = buildParamName(...args, String(idx + 1));
    const tokenParams = [pName, token];

    paramRefs.push(paramRef(pName));
    params.push(tokenParams);
  }

  const query = expression(field, tokensMatch(paramRefs, partialMatch));

  return [query, flatten(params)];
};

const buildMultiTokenMatch = (field, prop, value) => buildTokensQuery(PARTIAL_MATCH_PARAMS_OPTIONS)(field, prop, value);

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

    return expression(field, tokensMatch(params, true));
  },
  any: (prop, field, expr) => {
    const propName = normalizePropName(prop);

    if (prop.endsWith('_tag')) {
      const params = expr.any.map((_, index) => {
        const name = buildParamName(FIELD_PREFIX, propName, ParamSuffix.any, index);
        return paramRef(name);
      });

      return expression(field, tag(params.join('|')));
    }

    const params = expr.any.map((param, index) => {
      const subparams = tokenize(param).map(
        (_, tokenIndex) => paramRef(buildParamName(FIELD_PREFIX, propName, ParamSuffix.any, index, tokenIndex))
      );

      return `'${subparams.join(' ')}'`;
    });

    return expression(field, `(${params.join('|')})`);
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
  any: (prop, expr) => {
    const propName = normalizePropName(prop);
    const params = [];

    if (prop.endsWith('_tag')) {
      expr.any.forEach((item, index) => {
        const name = buildParamName(FIELD_PREFIX, propName, ParamSuffix.any, index);
        params.push(name, quotedString(item));
      });

      return params;
    }

    expr.any.forEach((param, index) => {
      const subparams = tokenize(param).map(
        (paramValue, paramIndex) => {
          const paramName = buildParamName(FIELD_PREFIX, propName, ParamSuffix.any, index, paramIndex);
          return [paramName, paramValue];
        }
      );
      params.push(...subparams);
    });

    return flatten(params);
  },
};

const useTokens = (multiWords, propName) => {
  const props = propName.split('|');

  if (props.length > 1) { // #multi case
    return props.some((x) => multiWords.includes(x));
  }

  return multiWords.includes(propName);
};

const buildSearchQuery = (propName, valueOrExpr, options) => {
  const { multiWords = [] } = options;

  const field = namedField(propName);

  // Split by tokens if multiwords includes the field

  const isMultiWords = useTokens(multiWords, propName);

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

/**
 * Search Query Syntax -  https://redis.io/docs/stack/search/reference/query_syntax/
 */
const ANY_WHILDCARD = '*';
const FIELD = '@';
const PARAM_REFERENCE = '$';

const VALUE_SEPARATOR = ':';
const PIPE_SEPARATOR = '|';

const NEGATIVE = '-';
const POSITIVE = '+';
const INFINITY = 'inf';
const NEGATIVE_RANGE = `${NEGATIVE}${INFINITY}`;
const POSITIVE_RANGE = `${POSITIVE}${INFINITY}`;

const PUNCTUATION_REGEX = /[,.<>{}[\]"':;!@#$%^&*()\-+=~]+/g;

module.exports = exports = {
  namedField: (propName) => `${FIELD}${propName}`,
  paramRef: (name) => `${PARAM_REFERENCE}${name}`,

  // Expressions
  negative: (expr) => `${NEGATIVE}${expr}`,
  expression: (name, value) => `${name}${VALUE_SEPARATOR}${value}`,

  // Values
  selection: (value) => value,
  containsAny: (prefix) => `(${prefix}${ANY_WHILDCARD})`,
  union: (values = []) => `(${values.join(PIPE_SEPARATOR)})`,
  numericRange: (min = NEGATIVE_RANGE, max = POSITIVE_RANGE) => `[${min} ${max}]`,
  tag: (item) => `{${item}}`,
  tags: (items = []) => `{${items.join(PIPE_SEPARATOR)}}`,

  // Utils
  tokenize: (value) => value.replace(PUNCTUATION_REGEX, ' ').split(/\s/),
  containsKeyExpr: (value) => `contains(@__key, "${value}")`,
};

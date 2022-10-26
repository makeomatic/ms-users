/**
 * Search Query Syntax -  https://redis.io/docs/stack/search/reference/query_syntax/
 */

const ANY_WHILDCARD = '*';
const FIELD = '@';
const PARAM_REFERENCE = '$';

const VALUE_SEPARATOR = ':';
const PIPE_SEPARATOR = '|';

// const DIALECT_USE_PARAMS = '2';

const NEGATIVE = '-';
const POSITIVE = '+';
const INFINITY = 'inf';
const NEGATIVE_RANGE = `${NEGATIVE}${INFINITY}`;
const POSITIVE_RANGE = `${POSITIVE}${INFINITY}`;

module.exports = exports = {
  namedField: (propName) => `${FIELD}${propName}`,
  paramRef: (name) => `${PARAM_REFERENCE}${name}`,

  // Values
  selection: (value) => value,
  union: (values = []) => `(${values.join(PIPE_SEPARATOR)})`,
  numericRange: (min = NEGATIVE_RANGE, max = POSITIVE_RANGE) => `[${min} ${max}]`,
  negative: (expr) => `${NEGATIVE}${expr}`,
  tag: (item) => `{${item}}`,
  tags: (items = []) => `{${items.join(PIPE_SEPARATOR)}}`,
  // TODO check usage
  matchAny: (value) => `(${value}${ANY_WHILDCARD})`,

  // clause: = (foo bar) => { $weight: 2.0, $slop: 1, $inorder: false, }
  expression: (name, value) => `${name}${VALUE_SEPARATOR}${value}`,
};

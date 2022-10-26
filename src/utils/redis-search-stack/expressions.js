/**
 * Search Query Syntax -  https://redis.io/docs/stack/search/reference/query_syntax/
 */
export const ANY_WHILDCARD = '*';
export const FIELD = '@';
export const PARAM_REFERENCE = '$';

export const VALUE_SEPARATOR = ':';
export const PIPE_SEPARATOR = '|';

// const DIALECT_USE_PARAMS = '2';

export const NEGATIVE = '-';
export const POSITIVE = '+';
export const INFINITY = 'inf';
export const NEGATIVE_RANGE = `${NEGATIVE}${INFINITY}`;
export const POSITIVE_RANGE = `${POSITIVE}${INFINITY}`;

export const namedField = (propName) => `${FIELD}${propName}`;
export const paramRef = (name) => `${PARAM_REFERENCE}${name}`;

// Values
export const selection = (value) => value;

export const union = (values = []) => `(${values.join(PIPE_SEPARATOR)})`;

export const numericRange = (min = NEGATIVE_RANGE, max = POSITIVE_RANGE) => `[${min} ${max}]`;

export const negative = (expr) => `${NEGATIVE}${expr}`;

export const tag = (item) => `{${item}}`;

export const tags = (items = []) => `{${items.join(PIPE_SEPARATOR)}}`;

// export const clause = (attributes, values) => {
//   // TODO (foo bar) => { $weight: 2.0; $slop: 1; $inorder: false; }
// };

// TODO check usage
export const matchAny = (value) => `(${value}${ANY_WHILDCARD})`;

export const expression = (name, value) => `${name}${VALUE_SEPARATOR}${value}`;

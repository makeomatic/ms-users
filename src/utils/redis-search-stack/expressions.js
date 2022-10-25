/**
 * Search Query Syntax -  https://redis.io/docs/stack/search/reference/query_syntax/
 */
export const FIELD = '@';
export const ANY = '*';

export const VALUE_SEPARATOR = ':';
export const PIPE_SEPARATOR = '|';

export const NEGATIVE = '-';
export const POSITIVE = '+';
export const INFINITY = 'inf';
export const NEGATIVE_RANGE = `${NEGATIVE}${INFINITY}`;
export const POSITIVE_RANGE = `${POSITIVE}${INFINITY}`;

export const field = (name) => `${FIELD}${name}`;

export const selection = (value) => value;
export const union = (values = []) => `(${values.join()})`;

export const numericRange = (min = NEGATIVE_RANGE, max = POSITIVE_RANGE) => `[${min} ${max}]`;

export const negative = (expr) => `${NEGATIVE}${expr}`;

export const tags = (items = []) => `{${items.join(PIPE_SEPARATOR)}}`;

export const clause = (attributes, values) => {
  // TODO (foo bar) => { $weight: 2.0; $slop: 1; $inorder: false; }
  const items = attributes.map((x, index) => `$${x}${VALUE_SEPARATOR}${values[index]}`);
  return `{${items.join(';')}}`;
};

export const expression = (name, value) => `${field(name)}${VALUE_SEPARATOR}${value}`;

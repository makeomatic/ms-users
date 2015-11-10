const SEPARATOR = '!';

/**
 * Creates string key from passed arguments
 * @return {String}
 */
module.exports = function combineKey(...args) {
  return args.join(SEPARATOR)
;};

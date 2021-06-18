module.exports = function isId(value) {
  return Number.isInteger(value) || (typeof value === 'string' && value.length > 0);
};

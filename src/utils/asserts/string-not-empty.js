module.exports = function stringNotEmpty(value) {
  return typeof value === 'string' && value.length !== 0;
};

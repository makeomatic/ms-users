module.exports = function normalizeIndexName(key) {
  return `${key.replaceAll('!', '_')}`;
};

module.exports = function normalizeIndexName(keyPrefix, key) {
  return `${keyPrefix}${key.replaceAll('!', '_')}_idx`;
};

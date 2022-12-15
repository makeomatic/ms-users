const extractUserId = (keyPrefix) => (userKey) => userKey.split('!')[0].slice(keyPrefix.length);

module.exports = extractUserId;

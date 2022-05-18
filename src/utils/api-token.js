const { NotFoundError } = require('common-errors');

function deserializeTokenData(raw) {
  const { scopes } = raw;
  if (scopes) {
    raw.scopes = JSON.parse(raw.scopes);
  }

  return raw;
}

function serializeTokenData(raw) {
  const { scopes, prefix, ...restData } = raw;

  if (Array.isArray(scopes)) {
    restData.scopes = JSON.stringify(raw.scopes);
  }

  if (prefix) restData.prefix = prefix;

  return restData;
}

function checkTokenData(raw) {
  if (Object.keys(raw).length < 1) {
    throw new NotFoundError('token not found');
  }

  return raw;
}

module.exports = {
  deserializeTokenData,
  serializeTokenData,
  checkTokenData,
};

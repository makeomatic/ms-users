const { HttpStatusError } = require('common-errors');

const { getExtendedMetadata } = require('./get-metadata');
const { getInternalData } = require('./user-data');
const { USERS_MFA_FLAG } = require('../constants');

/**
 * Verifies decoded token
 * @returns {Promise<{ id: string, metadata: Record<string, Record<string, any>>, mfa?: boolean, extra: Record<string, any>}>}
 */
async function fromTokenData(service, { username, userId, scopes, extra = {} }, params) {
  if (!userId && !username) {
    throw new HttpStatusError(403, 'forged or expired token');
  }

  const { audience, defaultAudience } = params;

  // push extra audiences
  if (audience.indexOf(defaultAudience) === -1) {
    audience.push(defaultAudience);
  }

  let internalData;
  let resolvedUserId = userId;
  let hasMFA;

  if (resolvedUserId == null) {
    internalData = await getInternalData.call(service, username);
    resolvedUserId = internalData.id;
    hasMFA = !!internalData[USERS_MFA_FLAG];
  }

  const metadata = await getExtendedMetadata(service, resolvedUserId, audience, { internalData });
  const result = {
    id: resolvedUserId,
    metadata,
    scopes,
    extra,
  };

  if (hasMFA !== undefined) {
    result[USERS_MFA_FLAG] = hasMFA;
  }

  return result;
}

module.exports = {
  fromTokenData,
};

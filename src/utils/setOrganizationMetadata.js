/* eslint-disable no-mixed-operators */
const OrganizationMetadata = require('../utils/metadata/organization');

/**
 * Updates metadata on a organization object
 * @param  {Object} opts
 * @return {Promise}
 */
async function setOrganizationMetadata(opts) {
  return new OrganizationMetadata(this.redis).update(opts);
}

module.exports = setOrganizationMetadata;

/**
 * Creates formatted uid
 * @param {Object} account
 * @return {String}
 */
module.exports = function uid(account) {
  return `${account.provider}:${account.profile.id}`;
};

module.exports = function refresh({ provider, internals }, { userId }) {
  return this.userData.refresh(userId, provider, internals);
};

/**
 * These are the setting for validation/transactional emails
 * @type {Object}
 */
exports.contacts = {
  phone: {
    ttl: 1 * 60 * 60 * 1000, // 1h in ms
  },
  email: {
    ttl: 1 * 60 * 60 * 1000,
  },
};

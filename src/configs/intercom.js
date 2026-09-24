/**
 * Intercom Messenger JWT configuration
 * NOTE: `secret` is the Messenger API secret of the workspace, must be injected in production
 * @type {Object}
 */
exports.intercom = {
  // when false `intercom` action responds with 501
  enabled: false,
  // HS256 signing key
  secret: '',
  // token lifetime, jose setExpirationTime() format
  ttl: '1h',
  // extra claims added to every token
  attributes: {
    studio_help_center_access: true,
  },
};

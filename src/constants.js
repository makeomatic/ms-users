const { HttpStatusError } = require('common-errors');

module.exports = exports = {
  // indices
  USERS_INDEX: 'user-iterator-set',
  USERS_PUBLIC_INDEX: 'users-public',
  USERS_ALIAS_TO_LOGIN: 'users-alias',
  USERS_SSO_TO_LOGIN: 'users-sso-hash',
  USERS_REFERRAL_INDEX: 'users-referral',

  // referral tracking
  USERS_REF: 'users-ref',

  // hashes
  USERS_DATA: 'data',
  USERS_METADATA: 'metadata',
  USERS_TOKENS: 'tokens',
  USERS_API_TOKENS: 'api-tokens',
  USERS_API_TOKENS_ZSET: 'api-tokens-set',

  USERS_ALIAS_FIELD: 'alias',
  USERS_BANNED_FLAG: 'ban',
  USERS_ACTIVE_FLAG: 'active',
  USERS_ADMIN_ROLE: 'admin',
  USERS_SUPER_ADMIN_ROLE: 'root',
  USERS_TESTER_ROLE: 'tester',
  USERS_BANNED_DATA: 'bannedData',
  USERS_CREATED_FIELD: 'created',
  USERS_USERNAME_FIELD: 'username',
  USERS_IS_ORG_FIELD: 'org',
  USERS_PASSWORD_FIELD: 'password',
  USERS_NEXT_CYCLE_FIELD: 'nextCycle',
  USERS_REFERRAL_FIELD: 'referral',
  USERS_SSO_FACEBOOK_FIELD: 'facebook',

  // pre-generated errors
  USERS_DISPOSABLE_PASSWORD_MIA: new HttpStatusError(403, 'Invalid or Expired Password'),
  USER_ALREADY_ACTIVE: new HttpStatusError(417, 'this user is already active'),
  ErrorConflictUserExists: new HttpStatusError(409, 'user already exists'),

  // actions
  USERS_ACTION_ACTIVATE: 'activate',
  USERS_ACTION_DISPOSABLE_PASSWORD: 'disposable-password',
  USERS_ACTION_PASSWORD: 'password',
  USERS_ACTION_RESET: 'reset',
  USERS_ACTION_REGISTER: 'register',
  USERS_ACTION_INVITE: 'invite',

  // invitations constants
  INVITATIONS_INDEX: 'user-invitations',

  // token
  TOKEN_METADATA_FIELD_METADATA: '1',
  TOKEN_METADATA_FIELD_SENDED_AT: '2',
  TOKEN_METADATA_FIELD_CONTEXT: '3',

  // challenge types
  CHALLENGE_TYPE_EMAIL: 'email',
  CHALLENGE_TYPE_PHONE: 'phone',

  // lock names
  lockAlias: alias => `users:alias:${alias}`,
  lockRegister: username => `users:register:${username}`,
};

// embed error codes
exports.ErrorConflictUserExists.code = 'E_USERNAME_CONFLICT';

exports.SSO_PROVIDERS = [
  exports.USERS_SSO_FACEBOOK_FIELD,
];

exports.FIELDS_TO_STRINGIFY = [
  exports.USERS_SSO_FACEBOOK_FIELD,
];

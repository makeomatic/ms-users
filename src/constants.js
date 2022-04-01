const { HttpStatusError } = require('common-errors');

module.exports = exports = {
  // indices
  USERS_INDEX: 'user-iterator-set',
  USERS_PUBLIC_INDEX: 'users-public',
  USERS_REFERRAL_INDEX: 'users-referral',
  ORGANIZATIONS_INDEX: 'organization-iterator-set',
  USERS_DEFAULT_CONTACT: 'user-default-contact',

  // id mapping
  USERS_ALIAS_TO_ID: 'users-alias',
  USERS_SSO_TO_ID: 'users-sso-hash',
  USERS_USERNAME_TO_ID: 'users-username',
  ORGANIZATIONS_NAME_TO_ID: 'organization-name',

  // referral tracking
  USERS_REF: 'users-ref',
  USERS_REF_METADATA: 'users-ref-metadata',

  // hashes
  USERS_DATA: 'data',
  USERS_METADATA: 'metadata',
  USERS_CONTACTS: 'contacts',
  USERS_TOKENS: 'tokens',
  USERS_API_TOKENS: 'api-tokens',
  USERS_API_TOKENS_ZSET: 'api-tokens-set',
  USERS_MFA_FLAG: 'mfa',
  USERS_MFA_RECOVERY: 'mfa-recovery',
  USERS_ORGANIZATIONS: 'user-organizations',
  ORGANIZATIONS_DATA: 'data',
  ORGANIZATIONS_METADATA: 'metadata',
  ORGANIZATIONS_MEMBERS: 'members',

  // standard JWT with TTL
  USERS_ID_FIELD: 'id',
  USERS_ALIAS_FIELD: 'alias',
  USERS_BANNED_FLAG: 'ban',
  USERS_ACTIVE_FLAG: 'active',
  USERS_ADMIN_ROLE: 'admin',
  USERS_SUPER_ADMIN_ROLE: 'root',
  USERS_TESTER_ROLE: 'tester',
  USERS_BANNED_DATA: 'bannedData',
  USERS_CREATED_FIELD: 'created',
  USERS_ACTIVATED_FIELD: 'aa',
  USERS_USERNAME_FIELD: 'username',
  USERS_IS_ORG_FIELD: 'org',
  USERS_PASSWORD_FIELD: 'password',
  USERS_NEXT_CYCLE_FIELD: 'nextCycle',
  USERS_REFERRAL_FIELD: 'referral',
  USERS_REFERRAL_META_FIELD: 'referralMeta',
  USERS_SSO_FACEBOOK_FIELD: 'facebook',
  USERS_SSO_APPLE_FIELD: 'apple',
  ORGANIZATIONS_ID_FIELD: 'id',
  ORGANIZATIONS_CREATED_FIELD: 'created',
  ORGANIZATIONS_NAME_FIELD: 'name',
  ORGANIZATIONS_ACTIVE_FLAG: 'active',

  // bearer tokens
  BEARER_USERNAME_FIELD: 'userId',
  BEARER_LEGACY_USERNAME_FIELD: 'username',

  // pre-generated errors
  ERROR_AUTH_REQUIRED: new HttpStatusError(401, 'authentication required'),
  USERS_CREDENTIALS_REQUIRED_ERROR: new HttpStatusError(401, 'Credentials Required'),
  USERS_DISPOSABLE_PASSWORD_MIA: new HttpStatusError(403, 'Invalid or Expired Password'),
  USERS_INCORRECT_PASSWORD: new HttpStatusError(403, 'incorrect password'),
  USERS_AUDIENCE_MISMATCH: new HttpStatusError(403, 'audience mismatch'),
  USERS_INVALID_TOKEN: new HttpStatusError(403, 'invalid token'),
  USERS_MALFORMED_TOKEN: new HttpStatusError(403, 'malformed token'),

  USERS_JWT_EXPIRED: new HttpStatusError(401, 'expired token'),
  USERS_JWT_ACCESS_REQUIRED: new HttpStatusError(401, 'access token required'),
  USERS_JWT_REFRESH_REQUIRED: new HttpStatusError(401, 'refresh token required'),
  USERS_JWT_STATELESS_REQUIRED: new HttpStatusError(501, '`Stateless JWT` should be enabled'),

  USER_ALREADY_ACTIVE: new HttpStatusError(417, 'this user is already active'),
  ErrorAccountLocked: new HttpStatusError(423, 'Account has been locked'),
  ErrorConflictUserExists: new HttpStatusError(409, 'user already exists'),
  ErrorConflictOrganizationExists: new HttpStatusError(409, 'organization already exists'),
  ErrorOrganizationNotFound: new HttpStatusError(404, 'organization not found'),
  ErrorTotpRequired: Object.defineProperty(
    new HttpStatusError(403, 'TOTP required'),
    'credentials',
    { enumerable: false, writable: true }
  ),
  ErrorTotpInvalid: new HttpStatusError(403, 'TOTP invalid'),
  ErrorSecretRequired: new HttpStatusError(403, 'Secret required'),
  ErrorUserNotFound: new HttpStatusError(404, 'username not found'),
  ErrorUserNotMember: new HttpStatusError(404, 'username not member of organization'),
  ErrorInvitationExpiredOrUsed: new HttpStatusError(400, 'Invitation has expired or already been used'),

  // actions
  USERS_ACTION_ACTIVATE: 'activate',
  USERS_ACTION_VERIFY_CONTACT: 'verify-contact',
  USERS_ACTION_DISPOSABLE_PASSWORD: 'disposable-password',
  USERS_ACTION_PASSWORD: 'password',
  USERS_ACTION_RESET: 'reset',
  USERS_ACTION_REGISTER: 'register',
  USERS_ACTION_INVITE: 'invite',
  USERS_ACTION_ORGANIZATION_INVITE: 'organizationUserInvite',
  USERS_ACTION_ORGANIZATION_REGISTER: 'organizationUserRegister',
  USERS_ACTION_ORGANIZATION_ADD: 'organizationUserAdd',

  // invitations constants
  INVITATIONS_INDEX: 'user-invitations',
  organizationInvite: (organizationId) => `organization-invitations:${organizationId}`,
  inviteId: (organizationId, username) => `${organizationId}:${username}`,

  // token
  TOKEN_METADATA_FIELD_METADATA: '1',
  TOKEN_METADATA_FIELD_SENDED_AT: '2',
  TOKEN_METADATA_FIELD_CONTEXT: '3',

  // challenge types
  CHALLENGE_TYPE_EMAIL: 'email',
  CHALLENGE_TYPE_PHONE: 'phone',

  // MFA action types
  MFA_TYPE_REQUIRED: Symbol('required'),
  MFA_TYPE_OPTIONAL: Symbol('optional'),
  MFA_TYPE_DISABLED: Symbol('disabled'),

  // lock names
  lockAlias: (alias) => `users:alias:${alias}`,
  lockRegister: (username) => `users:register:${username}`,
  lockOrganization: (organizationName) => `organizations:create:${organizationName}`,
  lockBypass: (provider, userId) => `bypass:${provider}:${userId}`,
  lockContact: (contact) => `contact:${contact}`,

  // consul keys & prefixes
  KEY_PREFIX_REVOCATION_RULES: 'revocation-rules/',
};

// embed error codes
exports.ErrorConflictUserExists.code = 'E_USERNAME_CONFLICT';
exports.ErrorTotpRequired.code = 'E_TOTP_REQUIRED';
exports.ErrorTotpInvalid.code = 'E_TOTP_INVALID';
exports.ErrorSecretRequired.code = 'E_TOTP_NOSECRET';

exports.USERS_INVALID_TOKEN.code = 'E_TKN_INVALID';
exports.USERS_JWT_EXPIRED.code = 'E_TKN_EXPIRE';
exports.USERS_AUDIENCE_MISMATCH.code = 'E_TKN_AUDIENCE_MISMATCH';
exports.USERS_JWT_ACCESS_REQUIRED.code = 'E_TKN_ACCESS_TOKEN_REQUIRED';
exports.USERS_JWT_REFRESH_REQUIRED.code = 'E_TKN_REFRESH_TOKEN_REQUIRED';
exports.USERS_JWT_STATELESS_REQUIRED.code = 'E_STATELESS_NOT_ENABLED';

exports.SSO_PROVIDERS = [
  exports.USERS_SSO_FACEBOOK_FIELD,
  exports.USERS_SSO_APPLE_FIELD,
];

exports.FIELDS_TO_STRINGIFY = [
  exports.USERS_SSO_FACEBOOK_FIELD,
  exports.USERS_SSO_APPLE_FIELD,
];

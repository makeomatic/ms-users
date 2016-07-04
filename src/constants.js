module.exports = {
  // user indices data
  USERS_INDEX: 'user-iterator-set',
  USERS_PUBLIC_INDEX: 'users-public',
  USERS_ALIAS_TO_LOGIN: 'users-alias',
  USERS_DATA: 'data',
  USERS_METADATA: 'metadata',
  USERS_TOKENS: 'tokens',
  USERS_ALIAS_FIELD: 'alias',
  USERS_BANNED_FLAG: 'ban',
  USERS_ACTIVE_FLAG: 'active',
  USERS_ADMIN_ROLE: 'admin',
  USERS_TESTER_ROLE: 'tester',
  USERS_BANNED_DATA: 'bannedData',
  // mailing constants
  MAIL_ACTIVATE: 'activate',
  MAIL_RESET: 'reset',
  MAIL_PASSWORD: 'password',
  MAIL_REGISTER: 'register',
  MAIL_INVITE: 'invite',
  // invitations constants
  INVITATIONS_KEY: 'user-invitation',
  INVITATIONS_INDEX: 'user-invitations',
  INVITATIONS_FIELD_EXPIRE: '0',
  INVITATIONS_FIELD_METADATA: '1',
  INVITATIONS_FIELD_USED: '2',
  INVITATIONS_FIELD_EMAIL: '3',
  INVITATIONS_FIELD_SENT: '4',
  INVITATIONS_FIELD_DATE: '5',
  INVITATIONS_FIELD_GREETING: '6',
  // throttling
  THROTTLE_NAMESPACE: 'throttle',
  SECRETS_NAMESPACE: 'secret',
  // challenge types
  CHALLENGE_TYPE_EMAIL: 'email',
  CHALLENGE_TYPE_PHONE: 'phone',
};

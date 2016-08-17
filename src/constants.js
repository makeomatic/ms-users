module.exports = {
  // indices
  USERS_INDEX: 'user-iterator-set',
  USERS_PUBLIC_INDEX: 'users-public',
  USERS_ALIAS_TO_LOGIN: 'users-alias',

  // hashes
  USERS_DATA: 'data',
  USERS_METADATA: 'metadata',
  USERS_TOKENS: 'tokens',

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

  // email namespaces
  MAIL_ACTIVATE: 'activate',
  MAIL_RESET: 'reset',
  MAIL_PASSWORD: 'password',
  MAIL_REGISTER: 'register',
  MAIL_INVITE: 'invite',

  // invitations constants
  INVITATIONS_INDEX: 'user-invitations',
  INVITATIONS_FIELD_METADATA: '1',
  INVITATIONS_FIELD_SENT: '2',
  INVITATIONS_FIELD_CTX: '3',

  // challenge types
  CHALLENGE_TYPE_EMAIL: 'email',
  CHALLENGE_TYPE_PHONE: 'phone',

  // lock names
  lockAlias: alias => `users:alias:${alias}`,
  lockRegister: username => `users:register:${username}`,
};

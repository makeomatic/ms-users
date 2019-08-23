const Promise = require('bluebird');
const hbs = require('handlebars');
const path = require('path');
const fs = require('fs');
const ld = require('lodash');

const key = require('../key');
const {
  USERS_AUDIENCE,
  USERS_ALIAS_TO_ID,
  USERS_SSO_TO_ID,
  USERS_DATA,
  USERS_METADATA,
  USERS_TOKENS,
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  USERS_ORGANIZATIONS,
  USERS_ALIAS_FIELD,
  USERS_USERNAME_TO_ID,
  USERS_USERNAME_FIELD,
  SSO_PROVIDERS,
  THROTTLE_PREFIX,
  USERS_ACTION_ACTIVATE,
  USERS_ACTION_REGISTER,
  USERS_ACTION_PASSWORD,
  USERS_ACTION_RESET,

  ORGANIZATIONS_MEMBERS,
  ORGANIZATIONS_INVITATIONS_INDEX,
} = require('../../constants');

const templateName = 'deleteInactivatedUsers.lua.hbs';
const KEY_SEPARATOR = '!';

const keys = {
  USERS_ALIAS_TO_ID,
  USERS_SSO_TO_ID,
  USERS_USERNAME_TO_ID,
  USERS_INDEX,
  USERS_PUBLIC_INDEX,
  THROTTLE_PREFIX,
  ORGANIZATIONS_INVITATIONS_INDEX,
};

const keyTemplates = {
  USERS_DATA: key('{id}', USERS_DATA),
  USERS_METADATA: key('{id}', USERS_METADATA, '{audience}'),
  USERS_TOKENS: key('{id}', USERS_TOKENS),
  USERS_AUDIENCE: key('{id}', USERS_AUDIENCE),
  USERS_ORGANIZATIONS: key('{username}', USERS_ORGANIZATIONS),
  ORGANIZATIONS_MEMBERS: key('{orgid}', ORGANIZATIONS_MEMBERS),
  ORGANIZATIONS_MEMBER: key('{orgid}', ORGANIZATIONS_MEMBERS, '{username}'),
};

const templates = {
  ORGANIZATIONS_MEMBER: key('{orgid}', ORGANIZATIONS_MEMBERS, '{username}'),
};

const fields = {
  USERS_ALIAS_FIELD,
  USERS_USERNAME_FIELD,
};
const throttleActions = [
  USERS_ACTION_ACTIVATE,
  USERS_ACTION_PASSWORD,
  USERS_ACTION_REGISTER,
  USERS_ACTION_RESET,
];


const readFile = f => Promise.fromCallback((cb) => {
  return fs.readFile(f, 'utf-8', cb);
});

const prefixify = (prefix, obj) => {
  if (prefix !== '') {
    return ld.mapValues(obj, (value) => {
      return `${prefix}${value}`;
    });
  }
  return obj;
};

/**
 * Compiles script from template including partials
 * @param file - string path script template file
 * @param templateCtx - context passed into template
 * @returns {Promise<void>}
 */
async function compileTemplate(file, templateCtx) {
  const contents = await readFile(file);
  const scriptTemplate = await hbs.compile(contents);
  const name = path.basename(file, '.lua.hbs');

  return {
    name,
    lua: scriptTemplate(templateCtx),
  };
}

/**
 * Prepares context for script template
 * @param redisOptions
 * @returns {{keys: *, keyTemplates: *, fields: *, KEY_SEPARATOR: *, sso: *, throttleActions: *}}
 */
function templateContext(redisOptions) {
  const { keyPrefix } = redisOptions;

  return {
    KEY_SEPARATOR,
    fields,
    throttleActions,
    templates,
    keys: prefixify(keyPrefix, keys),
    keyTemplates: prefixify(keyPrefix, keyTemplates),
    sso: SSO_PROVIDERS,
  };
}

/**
 * Compiles and registers script
 * @param {ioredis} redis
 * @param redisConfig
 * @returns {Promise<void>}
 */
async function defineCommand(redis, redisConfig) {
  const { options, luaScripts } = redisConfig;

  const file = path.join(luaScripts, templateName);
  const templateCtx = templateContext(options);
  const { lua, name } = await compileTemplate(file, templateCtx);

  if (redis[name] !== null) {
    redis.defineCommand(name, { lua });
  } else {
    this.log.warn(`script ${name} already defined`);
  }
}

module.exports = defineCommand;

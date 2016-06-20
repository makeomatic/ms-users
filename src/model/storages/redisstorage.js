/**
 * Created by Stainwoortsel on 17.06.2016.
 */
const Errors = require('common-errors');
const remapMeta = require('../../utils/remapMeta');
const mapMetaResponse = require('../../utils/mapMetaResponse');
const mapValues = require('lodash/mapValues');
const moment = require('moment');
const sha256 = require('../../utils/sha256.js');
const fsort = require('redis-filtered-sort');
const noop = require('lodash/noop');
const get = require('lodash/get');
const is = require('is');
const {
  ModelError,
  ERR_ALIAS_ALREADY_ASSIGNED, ERR_ALIAS_ALREADY_TAKEN, ERR_USERNAME_NOT_EXISTS, ERR_USERNAME_NOT_FOUND,
  ERR_ATTEMPTS_LOCKED, ERR_TOKEN_FORGED,
} = require('../modelError');
/*
 ERR_ALIAS_ALREADY_EXISTS, ERR_USERNAME_ALREADY_ACTIVE,
 ERR_USERNAME_ALREADY_EXISTS,  ERR_ACCOUNT_MUST_BE_ACTIVATED,
 ERR_ACCOUNT_NOT_ACTIVATED, ERR_ACCOUNT_ALREADY_ACTIVATED, ERR_ACCOUNT_IS_LOCKED, ERR_ACCOUNT_IS_ALREADY_EXISTS,
 ERR_ADMIN_IS_UNTOUCHABLE, ERR_CAPTCHA_WRONG_USERNAME, ERR_CAPTCHA_ERROR_RESPONSE, ERR_EMAIL_DISPOSABLE,
 ERR_EMAIL_NO_MX, ERR_EMAIL_ALREADY_SENT, ERR_TOKEN_INVALID, ERR_TOKEN_AUDIENCE_MISMATCH, ERR_TOKEN_MISS_EMAIL,
 ERR_TOKEN_EXPIRED, ERR_TOKEN_BAD_EMAIL, ERR_TOKEN_CANT_DECODE, ERR_PASSWORD_INVALID,
 ERR_PASSWORD_INVALID_HASH, ERR_PASSWORD_INCORRECT, ERR_PASSWORD_SCRYPT_ERROR,
 ERR_ATTEMPTS_TO_MUCH_REGISTERED
*/

// JSON
const JSONStringify = JSON.stringify.bind(JSON);
const JSONParse = JSON.parse.bind(JSON);

// constants
const {
  USERS_DATA, USERS_METADATA, USERS_ALIAS_TO_LOGIN,
  USERS_ACTIVE_FLAG, USERS_INDEX, USERS_PUBLIC_INDEX,
  USERS_ALIAS_FIELD, USERS_TOKENS, USERS_BANNED_FLAG, USERS_BANNED_DATA,
} = require('../../constants');

// config's and base objects
const { redis, captcha: captchaConfig, config } = this;
const { deleteInactiveAccounts, jwt: { lockAfterAttempts, defaultAudience, hashingFunction: { ttl } } } = config;

/**
 * Generate hash key string
 * @param args
 * @returns {string}
 */
const generateKey = (...args) => {
  const SEPARATOR = '!';
  return args.join(SEPARATOR);
};


module.exports = {};

module.exports.User = {

  /**
   * Get user by username
   * @param username
   * @returns {Object}
   */
  getOne(username) {
    const userKey = generateKey(username, USERS_DATA);

    return redis
      .pipeline()
      .hget(USERS_ALIAS_TO_LOGIN, username)
      .exists(userKey)
      .hgetallBuffer(userKey)
      .exec()
      .spread((aliasToUsername, exists, data) => {
        if (aliasToUsername[1]) {
          return this.getUser(aliasToUsername[1]);
        }

        if (!exists[1]) {
          throw new ModelError(ERR_USERNAME_NOT_EXISTS);
        }

        return { ...data[1], username };
      });
  },

  /**
   * Get list of users by params
   * @param opts
   * @returns {Array}
   */
  getList(opts) {
    const { criteria, audience, filter } = opts;
    const strFilter = typeof filter === 'string' ? filter : fsort.filter(filter || {});
    const order = opts.order || 'ASC';
    const offset = opts.offset || 0;
    const limit = opts.limit || 10;
    const index = opts.public ? USERS_PUBLIC_INDEX : USERS_INDEX;

    const metaKey = generateKey('*', USERS_METADATA, audience);

    return redis
      .fsort(index, metaKey, criteria, order, strFilter, offset, limit)
      .then(ids => {
        const length = +ids.pop();
        if (length === 0 || ids.length === 0) {
          return [
            ids || [],
            [],
            length,
          ];
        }

        const pipeline = redis.pipeline();
        ids.forEach(id => {
          pipeline.hgetallBuffer(generateKey(id, USERS_METADATA, audience));
        });
        return Promise.all([
          ids,
          pipeline.exec(),
          length,
        ]);
      })
      .spread((ids, props, length) => {
        const users = ids.map(function remapData(id, idx) {
          const data = props[idx][1];
          const account = {
            id,
            metadata: {
              [audience]: data ? mapValues(data, JSONParse) : {},
            },
          };

          return account;
        });

        return {
          users,
          cursor: offset + limit,
          page: Math.floor(offset / limit + 1),
          pages: Math.ceil(length / limit),
        };
      });
  },

  /**
   * Get metadata of user
   * @param username
   * @param _audiences
   * @param fields
   * @param _public
   * @returns {Object}
   */
  getMeta(username, _audiences, fields = {}, _public = null) {
    const audiences = Array.isArray(_audiences) ? _audiences : [_audiences];
    const audience = Array.isArray(_audiences) ? _audiences[0] : _audiences;

    return Promise
      .map(audiences, _audience => {
        return redis.hgetallBuffer(generateKey(username, USERS_METADATA, _audience));
      })
      .then(data => {
        return remapMeta(data, audiences, fields);
      })
      .tap(_public ? (metadata) => {
        if (get(metadata, [audience, USERS_ALIAS_FIELD]) === username) {
          return;
        }

        throw new ModelError(ERR_USERNAME_NOT_FOUND);
      } : noop);
  },

  /**
   * Get ~real~ username by username or alias
   * @param username
   * @returns {String} username
   */
  getUsername(username) {
    return redis
      .pipeline()
      .hget(USERS_ALIAS_TO_LOGIN, username)
      .exists(generateKey(username, USERS_DATA))
      .exec()
      .spread((alias, exists) => {
        if (alias[1]) {
          return alias[1];
        }

        if (!exists[1]) {
          throw new ModelError(ERR_USERNAME_NOT_EXISTS, username);
        }

        return username;
      });
  },

  setAlias(username, alias, data) {
    if (data[USERS_ALIAS_FIELD]) {
      throw new ModelError(ERR_ALIAS_ALREADY_ASSIGNED);
    }

    const assigned = redis.hsetnx(USERS_ALIAS_TO_LOGIN, alias, username);
    if (assigned === 0) {
      throw new ModelError(ERR_ALIAS_ALREADY_TAKEN);
    }

    return redis
      .pipeline()
      .sadd(USERS_PUBLIC_INDEX, username)
      .hset(generateKey(username, USERS_DATA), USERS_ALIAS_FIELD, alias)
      .hset(generateKey(username, USERS_METADATA, defaultAudience), USERS_ALIAS_FIELD, JSONStringify)
      .exec();
  },

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {String} username
   */
  setPassword(username, hash) {
    return redis
      .hset(generateKey(username, USERS_DATA), 'password', hash)
      .return(username);
  },


  /**
   * Process metadata update operation for a passed audience (inner method)
   * @param  {Object} pipeline
   * @param  {String} key (audience)
   * @param  {Object} metadata
   * @returns {object}
   */
  _handleAudience(pipeline, key, metadata) {
    const $remove = metadata.$remove;
    const $removeOps = $remove && $remove.length || 0;
    if ($removeOps > 0) {
      pipeline.hdel(key, $remove);
    }

    const $set = metadata.$set;
    const $setKeys = $set && Object.keys($set);
    const $setLength = $setKeys && $setKeys.length || 0;
    if ($setLength > 0) {
      pipeline.hmset(key, mapValues($set, JSONStringify));
    }

    const $incr = metadata.$incr;
    const $incrFields = $incr && Object.keys($incr);
    const $incrLength = $incrFields && $incrFields.length || 0;
    if ($incrLength > 0) {
      $incrFields.forEach(fieldName => {
        pipeline.hincrby(key, fieldName, $incr[fieldName]);
      });
    }

    return { $removeOps, $setLength, $incrLength, $incrFields };
  },

  /**
   * Updates metadata of user by username and audience
   * @param username
   * @param audience
   * @param metadata
   * @returns {Object}
   */
  setMeta(username, audience, metadata) {
    const audiences = is.array(audience) ? audience : [audience];
    const keys = audiences.map(aud => generateKey(username, USERS_METADATA, aud));

    const pipe = redis.pipeline();
    const metaOps = is.array(metadata) ? metadata : [metadata];
    const operations = metaOps.map((meta, idx) => this._handleAudience(pipe, keys[idx], meta));
    return pipe.exec().then(res => mapMetaResponse(operations, res));
  },

  /**
   * Update meta of user by using direct script
   * @param username
   * @param audience
   * @param script
   * @returns {Object}
     */
  executeUpdateMetaScript(username, audience, script) {
    const audiences = is.array(audience) ? audience : [audience];
    const keys = audiences.map(aud => generateKey(username, USERS_METADATA, aud));

    // dynamic scripts
    const $scriptKeys = Object.keys(script);
    const scripts = $scriptKeys.map(scriptName => {
      const { lua, argv = [] } = script[scriptName];
      const sha = sha256(lua);
      const name = `ms_users_${sha}`;
      if (!is.fn(redis[name])) {
        redis.defineCommand(name, { lua });
      }
      return redis[name](keys.length, keys, argv);
    });

    // mapScriptResponse implementation
    return Promise.all(scripts).then(res => {
      const output = {};
      $scriptKeys.forEach((fieldName, idx) => {
        output[fieldName] = res[idx];
      });
      return output;
    });
  },

  /**
   * Create user account with alias and password
   * @param username
   * @param alias
   * @param hash
   * @param activate
   * @returns {*}
   */
  create(username, alias, hash, activate) {
    return this.adapter.create(username, alias, hash, activate);
  },

  /**
   * Remove user
   * @param username
   * @param data
   * @returns {*}
   */
  remove(username, data) {
    const audience = defaultAudience;
    const transaction = redis.multi();
    const alias = data[USERS_ALIAS_FIELD];
    if (alias) {
      transaction.hdel(USERS_ALIAS_TO_LOGIN, alias);
    }

    // clean indices
    transaction.srem(USERS_PUBLIC_INDEX, username);
    transaction.srem(USERS_INDEX, username);

    // remove metadata & internal data
    transaction.del(generateKey(username, USERS_DATA));
    transaction.del(generateKey(username, USERS_METADATA, audience));

    // remove auth tokens
    transaction.del(generateKey(username, USERS_TOKENS));

    // complete it
    return transaction.exec();
  },

  /**
   * Activate user
   * @param username
   * @returns {*}
   */
  activate(username) {
    const userKey = generateKey(username, USERS_DATA);

    // WARNING: `persist` is very important, otherwise we will lose user's information in 30 days
    // set to active & persist
    return redis
      .pipeline()
      .hget(userKey, USERS_ACTIVE_FLAG)
      .hset(userKey, USERS_ACTIVE_FLAG, 'true')
      .persist(userKey)
      .sadd(USERS_INDEX, username)
      .exec()
      .spread(function pipeResponse(isActive) {
        const status = isActive[1];
        if (status === 'true') {
          throw new Errors.HttpStatusError(417, `Account ${username} was already activated`);
        }
      });
  },

  /**
   * Ban user
   * @param username
   * @param opts
   * @returns {*}
   */
  lock(username, opts) {
    const { reason, whom, remoteip } = opts; // to guarantee writing only those three variables to metadata from opts
    const data = {
      banned: true,
      [USERS_BANNED_DATA]: {
        reason: reason || '',
        whom: whom || '',
        remoteip: remoteip || '',
      },
    };

    return redis
      .pipeline()
      .hset(generateKey(username, USERS_DATA), USERS_BANNED_FLAG, 'true')
      // set .banned on metadata for filtering & sorting users by that field
      .hmset(generateKey(username, USERS_METADATA, defaultAudience), mapValues(data, JSONStringify))
      .del(generateKey(username, USERS_TOKENS))
      .exec();
  },

  /**
   * Unlock banned user
   * @param username
   * @returns {*}
   */
  unlock(username) {
    return redis
      .pipeline()
      .hdel(generateKey(username, USERS_DATA), USERS_BANNED_FLAG)
      // remove .banned on metadata for filtering & sorting users by that field
      .hdel(generateKey(username, USERS_METADATA, defaultAudience), 'banned', USERS_BANNED_DATA)
      .exec();
  },
};

let loginAttempts;
module.exports.Attempts = {

  check: function check({ username, ip }) {
    const ipKey = generateKey(username, 'ip', ip);
    const pipeline = redis.pipeline();

    pipeline.incrby(ipKey, 1);
    if (config.keepLoginAttempts > 0) {
      pipeline.expire(ipKey, config.keepLoginAttempts);
    }

    return pipeline
      .exec()
      .spread(function incremented(incrementValue) {
        const err = incrementValue[0];
        if (err) {
          this.log.error('Redis error:', err);
          return;
        }

        loginAttempts = incrementValue[1];
        if (loginAttempts > lockAfterAttempts) {
          const duration = moment().add(config.keepLoginAttempts, 'seconds').toNow(true);
          throw new ModelError(ERR_ATTEMPTS_LOCKED, duration);
        }
      });
  },

  /**
   * Drop login attempts
   * @param username
   * @param ip
   * @returns {*}
     */
  drop: function drop(username, ip) {
    const ipKey = generateKey(username, 'ip', ip);
    loginAttempts = 0;
    return redis.del(ipKey);
  },

  /**
   * Get attempts count
   * @returns {*}
   */
  count: function count() {
    return loginAttempts;
  },
};

module.exports.Tokens = {
  add(username, token) {
    return redis.zadd(generateKey(username, USERS_TOKENS), Date.now(), token);
  },

  drop(username, token = null) {
    return token ?
      redis.zrem(generateKey(username, USERS_TOKENS), token) :
      redis.del(generateKey(username, USERS_TOKENS));
  },

  lastAccess(username, token) {
    const tokensHolder = generateKey(username, USERS_TOKENS);
    return redis.zscoreBuffer(tokensHolder, token).then(function getLastAccess(_score) {
      // parseResponse
      const score = parseInt(_score, 10);

      // throw if token not found or expired
      if (isNaN(score) || Date.now() > score + ttl) {
        throw new ModelError(ERR_TOKEN_FORGED);
      }

      return score;
    });
  },

};

module.exports.Utils = {

};

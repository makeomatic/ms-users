/**
 * Created by Stainwoortsel on 17.06.2016.
 */
const remapMeta = require('../../utils/remapMeta');
const mapMetaResponse = require('../../utils/mapMetaResponse');
const mapValues = require('lodash/mapValues');
const sha256 = require('../../utils/sha256.js');
const fsort = require('redis-filtered-sort');
const uuid = require('node-uuid');
const noop = require('lodash/noop');
const get = require('lodash/get');
const is = require('is');
const {
  ModelError,
  ERR_ALIAS_ALREADY_ASSIGNED, ERR_ALIAS_ALREADY_TAKEN, ERR_USERNAME_NOT_EXISTS, ERR_USERNAME_NOT_FOUND,
  ERR_TOKEN_FORGED, ERR_CAPTCHA_WRONG_USERNAME, ERR_ATTEMPTS_TO_MUCH_REGISTERED,
  ERR_ALIAS_ALREADY_EXISTS, ERR_ACCOUNT_IS_ALREADY_EXISTS, ERR_ACCOUNT_ALREADY_ACTIVATED,
} = require('../modelError');
/*
  ERR_USERNAME_ALREADY_ACTIVE,
 ERR_USERNAME_ALREADY_EXISTS,  ERR_ACCOUNT_MUST_BE_ACTIVATED,
 ERR_ACCOUNT_NOT_ACTIVATED, ERR_ACCOUNT_IS_LOCKED
 ERR_ADMIN_IS_UNTOUCHABLE, ERR_CAPTCHA_ERROR_RESPONSE, ERR_EMAIL_DISPOSABLE,
 ERR_EMAIL_NO_MX, ERR_EMAIL_ALREADY_SENT, ERR_TOKEN_INVALID, ERR_TOKEN_AUDIENCE_MISMATCH, ERR_TOKEN_MISS_EMAIL,
 ERR_TOKEN_EXPIRED, ERR_TOKEN_BAD_EMAIL, ERR_TOKEN_CANT_DECODE, ERR_PASSWORD_INVALID,
 ERR_PASSWORD_INVALID_HASH, ERR_PASSWORD_INCORRECT, ERR_PASSWORD_SCRYPT_ERROR,

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

/**
 * Generate hash key string
 * @param args
 * @returns {string}
 */
const generateKey = (...args) => {
  const SEPARATOR = '!';
  return args.join(SEPARATOR);
};

exports.User = {

  /**
   * Get user by username
   * @param username
   * @returns {Object}
   */
  getOne(username) {
    const userKey = generateKey(username, USERS_DATA);
    const { redis } = this;

    return redis
      .pipeline()
      .hget(USERS_ALIAS_TO_LOGIN, username)
      .exists(userKey)
      .hgetallBuffer(userKey)
      .exec()
      .spread((aliasToUsername, exists, data) => {
        if (aliasToUsername[1]) {
          return exports.User.getOne.call(this, aliasToUsername[1]);
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
    const { redis } = this;
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
    const { redis } = this;
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
    const { redis } = this;

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

  checkAlias(alias) {
    const { redis } = this;

    return redis
      .hget(USERS_ALIAS_TO_LOGIN, alias)
      .then(username => {
        if (username) {
          throw new ModelError(ERR_ALIAS_ALREADY_EXISTS, alias);
        }

        return username;
      });
  },

  /**
   * Set up alias of user
   * @param opts
   * @returns {*}
     */
  setAlias(opts) {
    const { redis, config } = this;
    const { jwt: { defaultAudience } } = config;
    const { username, alias, data } = opts;

    if (data && data[USERS_ALIAS_FIELD]) {
      throw new ModelError(ERR_ALIAS_ALREADY_ASSIGNED);
    }

    return redis
      .hsetnx(USERS_ALIAS_TO_LOGIN, alias, username)
      .then(assigned => {
        if (assigned === 0) {
          throw new ModelError(ERR_ALIAS_ALREADY_TAKEN);
        }

        return redis
          .pipeline()
          .sadd(USERS_PUBLIC_INDEX, username)
          .hset(generateKey(username, USERS_DATA), USERS_ALIAS_FIELD, alias)
          .hset(generateKey(username, USERS_METADATA, defaultAudience), USERS_ALIAS_FIELD, JSON.stringify(alias))
          .exec();
      });
  },

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {String} username
   */
  setPassword(username, hash) {
    const { redis } = this;

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
  handleAudience(pipeline, key, metadata) {
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
  setMeta(opts) {
    const { redis } = this;
    const { username, audience, metadata, script } = opts;
    const audiences = is.array(audience) ? audience : [audience];
    const keys = audiences.map(aud => generateKey(username, USERS_METADATA, aud));

    if (metadata) {
      const pipe = redis.pipeline();
      const metaOps = is.array(metadata) ? metadata : [metadata];
      const operations = metaOps.map((meta, idx) => exports.User.handleAudience(pipe, keys[idx], meta));
      return pipe.exec().then(res => mapMetaResponse(operations, res));
    }

    return exports.User.executeUpdateMetaScript.call(this, username, audience, script);
  },

  /**
   * Update meta of user by using direct script
   * @param username
   * @param audience
   * @param script
   * @returns {Object}
     */
  executeUpdateMetaScript(username, audiences, script) {
    const { redis } = this;
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
    const { redis, config } = this;
    const { deleteInactiveAccounts } = config;
    const userDataKey = generateKey(username, USERS_DATA);
    const pipeline = redis.pipeline();

    pipeline
    // add password
      .hsetnx(userDataKey, 'password', hash)
    // set activation flag
      .hsetnx(userDataKey, USERS_ACTIVE_FLAG, activate);

    // if we can activate user
    if (activate) {
      // store username to index
      pipeline.sadd(USERS_INDEX, username);
    }

    // well done! let's execute
    return pipeline
      .exec()
      .spread(function insertedUserData(passwordSetResponse) {
        if (passwordSetResponse[1] === 0) {
          throw new ModelError(ERR_ACCOUNT_IS_ALREADY_EXISTS, username);
        }

        if (!activate && deleteInactiveAccounts >= 0) {
          // WARNING: IF USER IS NOT VERIFIED WITHIN <deleteInactiveAccounts>
          // [by default 30] DAYS - IT WILL BE REMOVED FROM DATABASE
          return redis.expire(userDataKey, deleteInactiveAccounts);
        }

        return null;
      })
      // setting alias, if we can
      .tap(activate && alias ? () => exports.User.setAlias.call(this, { username, alias }) : noop);
  },

  /**
   * Remove user
   * @param username
   * @param data
   * @returns {*}
   */
  remove(username, data) {
    const { redis, config } = this;
    const { jwt: { defaultAudience } } = config;

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
    const { redis } = this;
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
          throw new ModelError(ERR_ACCOUNT_ALREADY_ACTIVATED, username);
        }
      });
  },

  /**
   * Ban user
   * @param username
   * @param opts
   * @returns {*}
   */
  lock(opts) {
    const { redis, config } = this;
    const { jwt: { defaultAudience } } = config;

    const { username, reason, whom, remoteip } = opts; // to guarantee writing only those three variables to metadata from opts
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
  unlock({ username }) {
    const { redis, config } = this;
    const { jwt: { defaultAudience } } = config;

    return redis
      .pipeline()
      .hdel(generateKey(username, USERS_DATA), USERS_BANNED_FLAG)
      // remove .banned on metadata for filtering & sorting users by that field
      .hdel(generateKey(username, USERS_METADATA, defaultAudience), 'banned', USERS_BANNED_DATA)
      .exec();
  },
};

exports.Attempts = {
  /**
   * Check login attempts
   * @param username
   * @param ip
   * @returns {*}
     */
  check: function check({ username, ip }) {
    const { redis, config } = this;
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
          return null;
        }
        return incrementValue[1];
      });
  },

  /**
   * Drop login attempts
   * @param username
   * @param ip
   * @returns {*}
     */
  drop: function drop(username, ip) {
    const { redis } = this;
    const ipKey = generateKey(username, 'ip', ip);
    return redis.del(ipKey);
  },
};

exports.Tokens = {
  /**
   * Add the token
   * @param username
   * @param token
   * @returns {*}
     */
  add(username, token) {
    const { redis } = this;
    return redis.zadd(generateKey(username, USERS_TOKENS), Date.now(), token);
  },

  /**
   * Drop the token
   * @param username
   * @param token
   * @returns {*}
     */
  drop(username, token = null) {
    const { redis } = this;
    return token ?
      redis.zrem(generateKey(username, USERS_TOKENS), token) :
      redis.del(generateKey(username, USERS_TOKENS));
  },

  /**
   * Get last token score
   * @param username
   * @param token
   * @returns {integer}
     */
  lastAccess(username, token) {
    const { redis, config } = this;
    const { jwt: { ttl } } = config;
    const tokensHolder = generateKey(username, USERS_TOKENS);
    return redis.zscoreBuffer(tokensHolder, token).then(_score => {
      // parseResponse
      const score = parseInt(_score, 10);

      // throw if token not found or expired
      if (isNaN(score) || Date.now() > score + ttl) {
        throw new ModelError(ERR_TOKEN_FORGED);
      }

      return score;
    });
  },

  /**
   * Get special email throttle state
   * @param type
   * @param email
   * @returns {bool} state
     */
  getEmailThrottleState(type, email) {
    const { redis } = this;
    const throttleEmailsKey = generateKey(`vthrottle-${type}`, email);
    return redis.get(throttleEmailsKey);
  },

  /**
   * Set special email throttle state
   * @param type
   * @param email
   * @returns {*}
     */
  setEmailThrottleState(type, email) {
    const { redis, config } = this;
    const throttleEmailsKey = generateKey(`vthrottle-${type}`, email);
    const { validation: { throttle } } = config;

    const throttleArgs = [throttleEmailsKey, 1, 'NX'];
    if (throttle > 0) {
      throttleArgs.splice(2, 0, 'EX', throttle);
    }
    return redis.set(throttleArgs);
  },

  /**
   * Get special email throttle token
   * @param type
   * @param token
   * @returns {string} email
     */
  getEmailThrottleToken(type, token) {
    const { redis } = this;
    const secretKey = generateKey(`vsecret-${type}`, token);
    return redis.get(secretKey);
  },

  /**
   * Set special email throttle token
   * @param type
   * @param email
   * @param token
   * @returns {*}
     */
  setEmailThrottleToken(type, email, token) {
    const { redis, config } = this;
    const { validation: { ttl } } = config;

    const secretKey = generateKey(`vsecret-${type}`, token);
    const args = [secretKey, email];
    if (ttl > 0) {
      args.push('EX', ttl);
    }
    return redis.set(args);
  },

  /**
   * Drop special email throttle token
   * @param type
   * @param token
   * @returns {*}
     */
  dropEmailThrottleToken(type, token) {
    const { redis } = this;
    const secretKey = generateKey(`vsecret-${type}`, token);
    return redis.del(secretKey);
  },

};

exports.Utils = {
  /**
   * Check IP limits for registration
   * @param ipaddress
   * @returns {*}
     */
  checkIPLimits(ipaddress) {
    // TODO: КРИВО, в оригинале есть проверка на существование registrationLimits

    // if (registrationLimits.ip && ipaddress) {
    //   promise = promise.tap(checkLimits(redis, registrationLimits, ipaddress));
    // }

    const { redis, config } = this;
    const { registrationLimits: { ip: { time, times } } } = config;
    const ipaddressLimitKey = generateKey('reg-limit', ipaddress);
    const now = Date.now();
    const old = now - time;

    return function iplimits() {
      return redis
        .pipeline()
        .zadd(ipaddressLimitKey, now, uuid.v4())
        .pexpire(ipaddressLimitKey, time)
        .zremrangebyscore(ipaddressLimitKey, '-inf', old)
        .zcard(ipaddressLimitKey)
        .exec()
        .then(props => {
          const cardinality = props[3][1];
          if (cardinality > times) {
            throw new ModelError(ERR_ATTEMPTS_TO_MUCH_REGISTERED);
          }
        });
    };
  },

  /**
   * Check captcha
   * @param username
   * @param captcha
   * @param next
   * @returns {*}
     */
  checkCaptcha(username, captcha, next = null) {
    const { redis, config } = this;
    const { captcha: captchaConfig } = config;

    return () => {
      const captchaCacheKey = captcha.response;
      return redis
        .pipeline()
        .set(captchaCacheKey, username, 'EX', captchaConfig.ttl, 'NX')
        .get(captchaCacheKey)
        .exec()
        .spread(function captchaCacheResponse(setResponse, getResponse) {
          if (getResponse[1] !== username) {
            throw new ModelError(ERR_CAPTCHA_WRONG_USERNAME);
          }
        })
        // check google captcha
        .then(next ? () => next.call(this, captcha) : noop);
    };
  },
};

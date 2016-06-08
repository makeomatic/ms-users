/**
 * Created by Stainwoortsel on 30.05.2016.
 */
const Promise = require('bluebird');
const Errors = require('common-errors');
const mapValues = require('lodash/mapValues');
const get = require('lodash/get');
const pick = require('lodash/pick');
const uuid = require('node-uuid');
const is = require('is');
const sha256 = require('../utils/sha256.js');
const moment = require('moment');
const verifyGoogleCaptcha = require('../utils/verifyGoogleCaptcha');
const mapMetaResponse = require('../utils/mapMetaResponse');

// JSON
const JSONStringify = JSON.stringify.bind(JSON);
const JSONParse = JSON.parse.bind(JSON);

// constants
const {
  USERS_DATA, USERS_METADATA, USERS_ALIAS_TO_LOGIN,
  USERS_BANNED_FLAG, USERS_TOKENS, USERS_BANNED_DATA,
  USERS_ACTIVE_FLAG, USERS_INDEX, USERS_PUBLIC_INDEX,
  USERS_ALIAS_FIELD, USERS_ADMIN_ROLE,
} = require('../constants.js');

// config's and base objects
const { redis, captcha: captchaConfig, config } = this;
const { deleteInactiveAccounts, jwt: { lockAfterAttempts, defaultAudience } } = config;

// local vatiables inside the module
let remoteipKey;
let loginAttempts;


/**
 * Generate hash key string
 * @param args
 * @returns {string}
 */
const generateKey = (...args) => {
  const SEPARATOR = '!';
  return args.join(SEPARATOR);
};

module.exports = {
  /**
   * Lock user
   * @param username
   * @param reason
   * @param whom
   * @param remoteip
   * @returns {Redis|{index: number, input: string}}
   */
  lockUser({ username, reason, whom, remoteip }) {
    const data = {
      banned: true,
      [USERS_BANNED_DATA]: {
        reason,
        whom,
        remoteip,
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
   * Unlock user
   * @param username
   * @returns {Redis|{index: number, input: string}}
   */
  unlockUser({ username }) {
    return redis
      .pipeline()
      .hdel(generateKey(username, USERS_DATA), USERS_BANNED_FLAG)
      // remove .banned on metadata for filtering & sorting users by that field
      .hdel(generateKey(username, USERS_METADATA, defaultAudience), 'banned', USERS_BANNED_DATA)
      .exec();
  },

  /**
   * Check existance of user
   * @param username
   * @returns {Redis|username}
   */
  isExists(username) {
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
          throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
        }

        return username;
      });
  },

  /**
   * Check the existance of alias
   * @param alias
   * @returns {username|''}
   */
  aliasAlreadyExists(alias) {
    return redis
      .hget(USERS_ALIAS_TO_LOGIN, alias)
      .then(username => {
        if (username) {
          throw new Errors.HttpStatusError(409, `"${alias}" already exists`);
        }

        return username;
      });
  },

  /**
   * User is public
   * @param username
   * @param audience
   * @returns {function()}
     */
  isPublic(username, audience) {
    return metadata => {
      if (get(metadata, [audience, USERS_ALIAS_FIELD]) === username) {
        return;
      }

      throw new Errors.HttpStatusError(404, 'username was not found');
    };
  },


  /**
   * Check that user is active
   * @param data
   * @returns {Promise}
   */
  isActive(data) {
    if (String(data[USERS_ACTIVE_FLAG]) !== 'true') {
      return Promise.reject(new Errors.HttpStatusError(412, 'Account hasn\'t been activated'));
    }

    return Promise.resolve(data);
  },

  /**
   * Check that user is banned
   * @param data
   * @returns {Promise}
   */
  isBanned(data) {
    if (String(data[USERS_BANNED_FLAG]) === 'true') {
      return Promise.reject(new Errors.HttpStatusError(423, 'Account has been locked'));
    }

    return Promise.resolve(data);
  },

  /**
   * Activate user account
   * @param user
   * @returns {Redis}
   */
  activateAccount(user) {
    const userKey = generateKey(user, USERS_DATA);

    // WARNING: `persist` is very important, otherwise we will lose user's information in 30 days
    // set to active & persist
    return redis
      .pipeline()
      .hget(userKey, USERS_ACTIVE_FLAG)
      .hset(userKey, USERS_ACTIVE_FLAG, 'true')
      .persist(userKey)
      .sadd(USERS_INDEX, user)
      .exec()
      .spread(function pipeResponse(isActive) {
        const status = isActive[1];
        if (status === 'true') {
          throw new Errors.HttpStatusError(417, `Account ${user} was already activated`);
        }
      });
  },

  /**
   * Get user internal data
   * @param username
   * @returns {Object}
   */
  getUser(username) {
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
          throw new Errors.HttpStatusError(404, `"${username}" does not exists`);
        }

        return { ...data[1], username };
      });
  },

  _getMeta(username, audience) {
    return redis.hgetallBuffer(generateKey(username, USERS_METADATA, audience));
  },
  _remapMeta(data, audiences, fields) {
    const output = {};
    audiences.forEach(function transform(aud, idx) {
      const datum = data[idx];

      if (datum) {
        const pickFields = fields[aud];
        output[aud] = mapValues(datum, JSONParse);
        if (pickFields) {
          output[aud] = pick(output[aud], pickFields);
        }
      } else {
        output[aud] = {};
      }
    });

    return output;
  },


  /**
   * Get users metadata by username and audience
   * @param username
   * @param audience
   * @param fields
   * @returns {Object}
   */
  getMetadata(username, _audiences, fields = {}) {
    const audiences = Array.isArray(_audiences) ? _audiences : [_audiences];

    return Promise
      .map(audiences, audience => {
        return this._getMeta(username, audience);
      })
      .then(data => {
        return this._remapMeta(data, audiences, fields);
      });
  },


  /**
   * Return the list of users by specified params
   * @param opts
   * @returns {Array}
   */
  getList(opts) {
    const { criteria, audience, index, strFilter, order, offset, limit } = opts;
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
   * Check that user is admin
   * @param meta
   * @returns {boolean}
  */
  isAdmin(meta) {
    const audience = config.jwt.defaultAudience;
    return (meta[audience].roles || []).indexOf(USERS_ADMIN_ROLE) >= 0;
  },

  /**
   * Make the linkage between username and alias into the USERS_ALIAS_TO_LOGIN
   * @param username
   * @param alias
   * @returns {Redis}
     */
  storeAlias(username, alias) {
    return redis.hsetnx(USERS_ALIAS_TO_LOGIN, alias, username);
  },

  /**
   * Assign alias to the user record, marked by username
   * @param username
   * @param alias
   * @returns {Redis}
     */
  assignAlias(username, alias) {
    return redis
      .pipeline()
      .sadd(USERS_PUBLIC_INDEX, username)
      .hset(generateKey(username, USERS_DATA), USERS_ALIAS_FIELD, alias)
      .hset(generateKey(username, USERS_METADATA, defaultAudience), USERS_ALIAS_FIELD, JSONStringify)
      .exec();
  },

  /**
   * Return current login attempts count
   * @returns {int}
   */
  getAttempts() {
    return loginAttempts;
  },

  /**
   * Drop login attempts counter
   * @returns {Redis}
   */
  dropAttempts() {
    loginAttempts = 0;
    if (remoteipKey) {
      return redis.del(remoteipKey);
    }

    throw new Errors.Error('Empty remote ip key');
  },

  /**
   * Check login attempts
   * @param data
   * @param _remoteip
   * @returns {Redis}
   */
  checkLoginAttempts(data, _remoteip) {
    const pipeline = redis.pipeline();
    const { username } = data;
    remoteipKey = generateKey(username, 'ip', _remoteip);

    pipeline.incrby(remoteipKey, 1);
    if (config.jwt.keepLoginAttempts > 0) {
      pipeline.expire(remoteipKey, config.jwt.keepLoginAttempts);
    }

    return pipeline
      .exec()
      .spread(function incremented(incrementValue) {
        const err = incrementValue[0];
        if (err) {
          throw new Errors.data.RedisError(err);
        }

        loginAttempts = incrementValue[1];
        if (loginAttempts > lockAfterAttempts) {
          const duration = moment().add(config.jwt.keepLoginAttempts, 'seconds').toNow(true);
          const msg = `You are locked from making login attempts for the next ${duration}`;
          throw new Errors.HttpStatusError(429, msg);
        }
      });
  },

  /**
   * Set user password
   * @param username
   * @param hash
   * @returns {Redis}
     */
  setPassword({ username, hash }) {
    return redis
      .hset(generateKey(username, USERS_DATA), 'password', hash)
      .return(username);
  },

  /**
   * Reset the lock by IP
   * @param username
   * @param ip
   * @returns {Redis}
     */
  resetIPLock(username, ip) {
    return redis.del(generateKey(username, 'ip', ip));
  },


  /**
   * Process metadata update operation for a passed audience / inner method
   * @param  {Object} pipeline
   * @param  {String} audience
   * @param  {Object} metadata
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
   *
   * @param username
   * @param audience
   * @param metadata
   * @returns {Object}
   */
  updateMetadata({ username, audience, metadata, script }) {
    const audiences = is.array(audience) ? audience : [audience];

    // keys
    const keys = audiences.map(aud => generateKey(username, USERS_METADATA, aud));

    // if we have meta, then we can
    if (metadata) {
      const pipe = redis.pipeline();
      const metaOps = is.array(metadata) ? metadata : [metadata];
      const operations = metaOps.map((meta, idx) => this._handleAudience(pipe, keys[idx], meta));
      return pipe.exec().then(res => mapMetaResponse(operations, res));
    }

    // or...
    return this.customScript(script, keys);
  },

  /**
   * Removing user by username (and data?)
   * @param username
   * @param data
   * @returns {*|{arity, flags, keyStart, keyStop, step}|Array|{index: number, input: string}}
   */
  removeUser(username, data) {
    const audience = config.jwt.defaultAudience;
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
   * Verify ip limits
   * @param  {redisCluster} redis
   * @param  {Object} registrationLimits
   * @param  {String} ipaddress
   * @return {Function}
   */
  checkLimits(ipaddress) {
    const { registrationLimits } = config;
    const { ip: { time, times } } = registrationLimits;
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
            const msg = 'You can\'t register more users from your ipaddress now';
            throw new Errors.HttpStatusError(429, msg);
          }
        });
    };
  },

  /**
   * Creates user with a given hash
   * @param redis
   * @param username
   * @param activate
   * @param userDataKey
   * @returns {Function}
   */
  createUser(username, activate) {
    /**
     * Input from scrypt.hash
     */
    const userDataKey = generateKey(username, USERS_DATA);

    return function create(hash) {
      const pipeline = redis.pipeline();

      pipeline.hsetnx(userDataKey, 'password', hash);
      pipeline.hsetnx(userDataKey, USERS_ACTIVE_FLAG, activate);

      return pipeline
        .exec()
        .spread(function insertedUserData(passwordSetResponse) {
          if (passwordSetResponse[1] === 0) {
            throw new Errors.HttpStatusError(412, `User "${username}" already exists`);
          }

          if (!activate && deleteInactiveAccounts >= 0) {
            // WARNING: IF USER IS NOT VERIFIED WITHIN <deleteInactiveAccounts>
            // [by default 30] DAYS - IT WILL BE REMOVED FROM DATABASE
            return redis.expire(userDataKey, deleteInactiveAccounts);
          }

          return null;
        });
    };
  },

  /**
   * Performs captcha check, returns thukn
   * @param  {String} username
   * @param  {String} captcha
   * @return {Function}
   */
  checkCaptcha(username, captcha) {
    const { ttl } = captchaConfig;
    return function checkTheCaptcha() {
      const captchaCacheKey = captcha.response;
      return redis
        .pipeline()
        .set(captchaCacheKey, username, 'EX', ttl, 'NX')
        .get(captchaCacheKey)
        .exec()
        .spread(function captchaCacheResponse(setResponse, getResponse) {
          if (getResponse[1] !== username) {
            const msg = 'Captcha challenge you\'ve solved can not be used, please complete it again';
            throw new Errors.HttpStatusError(412, msg);
          }
        })
        .then(() => verifyGoogleCaptcha(captcha));
    };
  },

  /**
   * Stores username to the index set
   * @param username
   * @returns {Redis}
   */
  storeUsername(username) {
    return redis.sadd(USERS_INDEX, username);
  },

  /**
   * Execute custom script on LUA
   * @param script
   * @returns {Promise}
   */
  customScript(script, keys) {
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

    return Promise.all(scripts).then(res => {
      const output = {};
      $scriptKeys.forEach((fieldName, idx) => {
        output[fieldName] = res[idx];
      });
      return output;
    });
  },

  handleAudience(key, metadata) {
    const pipeline = redis.pipeline();
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
};
